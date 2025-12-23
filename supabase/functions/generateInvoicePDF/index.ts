import { createClientFromRequest } from '../base44Shim.js';
import { jsPDF } from 'npm:jspdf@2.5.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return Response.json({ error: 'Missing invoice_id' }, { status: 400 });
    }

    // Get invoice
    const invoice = await base44.entities.Invoice.get(invoice_id);

    if (!invoice) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check if user owns this invoice (or is admin)
    if (invoice.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Load invoice settings
    const allSettings = await base44.entities.SiteSettings.list();
    const getSetting = (key, defaultValue) => {
      const setting = allSettings.find(s => s.setting_key === key);
      return setting?.setting_value || defaultValue;
    };

    const settings = {
      companyName: getSetting('invoice_company_name', 'WPHubPro'),
      companyDetails: getSetting('invoice_company_details', 'Cloud Plugin Management'),
      companyAddress: getSetting('invoice_company_address', ''),
      vatNumber: getSetting('invoice_vat_number', ''),
      logoUrl: getSetting('invoice_logo_url', ''),
      footer: getSetting('invoice_footer', 'Bedankt voor je vertrouwen in WPHubPro'),
      accentColor: getSetting('invoice_accent_color', '#6366f1'),
      itemBgColor: getSetting('invoice_item_bg_color', '#f9fafb'),
      textColor: getSetting('invoice_text_color', '#111827')
    };

    // Convert hex to RGB
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 99, g: 102, b: 241 };
    };

    const accentRgb = hexToRgb(settings.accentColor);
    const itemBgRgb = hexToRgb(settings.itemBgColor);
    const textRgb = hexToRgb(settings.textColor);

    // Create PDF
    const doc = new jsPDF();

    // Company info (top left)
    doc.setFontSize(10);
    doc.setTextColor(textRgb.r, textRgb.g, textRgb.b);
    doc.setFont(undefined, 'bold');
    doc.text(settings.companyName, 20, 20);
    doc.setFont(undefined, 'normal');
    
    let yPos = 26;
    if (settings.companyDetails) {
      const detailLines = settings.companyDetails.split('\n').slice(0, 3);
      detailLines.forEach((line) => {
        doc.text(line, 20, yPos);
        yPos += 6;
      });
    }
    
    if (settings.companyAddress) {
      const addressLines = settings.companyAddress.split('\n').slice(0, 3);
      addressLines.forEach((line) => {
        doc.text(line, 20, yPos);
        yPos += 6;
      });
    }
    
    if (settings.vatNumber) {
      doc.text(`BTW: ${settings.vatNumber}`, 20, yPos);
    }
    
    // Invoice title (top right)
    doc.setFontSize(24);
    doc.setTextColor(accentRgb.r, accentRgb.g, accentRgb.b);
    doc.setFont(undefined, 'bold');
    doc.text('FACTUUR', 150, 25);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Nr: ${invoice.invoice_number}`, 150, 32);
    doc.text(`Datum: ${new Date(invoice.created_date).toLocaleDateString('nl-NL')}`, 150, 38);
    if (invoice.due_date) {
      doc.text(`Vervaldatum: ${new Date(invoice.due_date).toLocaleDateString('nl-NL')}`, 150, 44);
    }

    // Customer info
    doc.setFontSize(10);
    doc.setTextColor(textRgb.r, textRgb.g, textRgb.b);
    doc.setFont(undefined, 'bold');
    doc.text('Factuur aan:', 20, 55);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(invoice.user_name || invoice.user_email, 20, 61);
    doc.text(invoice.user_email, 20, 67);
    
    if (invoice.billing_address && invoice.billing_address.line1) {
      let addrY = 73;
      doc.text(invoice.billing_address.line1, 20, addrY);
      if (invoice.billing_address.line2) {
        addrY += 6;
        doc.text(invoice.billing_address.line2, 20, addrY);
      }
      addrY += 6;
      const cityLine = `${invoice.billing_address.postal_code || ''} ${invoice.billing_address.city || ''}`.trim();
      if (cityLine) {
        doc.text(cityLine, 20, addrY);
        addrY += 6;
      }
      if (invoice.billing_address.country) {
        doc.text(invoice.billing_address.country, 20, addrY);
      }
    }

    // Table header
    const tableTop = 110;
    doc.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b);
    doc.rect(20, tableTop, 170, 10, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Omschrijving', 25, tableTop + 7);
    doc.text('Periode', 110, tableTop + 7);
    doc.text('Bedrag', 160, tableTop + 7);

    // Table content
    doc.setFont(undefined, 'normal');
    let y = tableTop + 18;
    
    // Add background for items
    doc.setFillColor(itemBgRgb.r, itemBgRgb.g, itemBgRgb.b);
    doc.rect(20, y - 5, 170, 12, 'F');
    
    doc.setTextColor(textRgb.r, textRgb.g, textRgb.b);
    const description = invoice.description || `${invoice.plan_name} - ${invoice.billing_period === 'month' ? 'Maandelijks' : 'Jaarlijks'} Abonnement`;
    doc.text(description, 25, y);
    
    if (invoice.period_start && invoice.period_end) {
      const periodText = `${new Date(invoice.period_start).toLocaleDateString('nl-NL')} - ${new Date(invoice.period_end).toLocaleDateString('nl-NL')}`;
      doc.text(periodText, 110, y);
    }
    
    const subtotalAmount = (invoice.subtotal / 100).toFixed(2).replace('.', ',');
    doc.text(`\u20AC ${subtotalAmount}`, 160, y);

    // Totals
    y += 30;
    doc.setDrawColor(accentRgb.r, accentRgb.g, accentRgb.b);
    doc.setLineWidth(0.5);
    doc.line(110, y, 190, y);
    
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont(undefined, 'normal');
    doc.text('Subtotaal:', 110, y);
    doc.text(`\u20AC ${subtotalAmount}`, 160, y);
    
    y += 6;
    doc.text(`BTW (${invoice.vat_percentage}%):`, 110, y);
    const vatAmount = (invoice.vat_amount / 100).toFixed(2).replace('.', ',');
    doc.text(`\u20AC ${vatAmount}`, 160, y);
    
    y += 8;
    doc.setFontSize(12);
    doc.setTextColor(textRgb.r, textRgb.g, textRgb.b);
    doc.setFont(undefined, 'bold');
    doc.text('Totaal:', 110, y);
    const totalAmount = (invoice.amount / 100).toFixed(2).replace('.', ',');
    doc.text(`\u20AC ${totalAmount}`, 160, y);

    // Payment status
    y += 15;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    if (invoice.status === 'paid') {
      doc.setTextColor(34, 197, 94); // green
      doc.text('STATUS: BETAALD', 20, y);
      if (invoice.paid_at) {
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Betaald op: ${new Date(invoice.paid_at).toLocaleDateString('nl-NL')}`, 20, y + 6);
      }
    } else {
      doc.setTextColor(239, 68, 68); // red
      doc.text('STATUS: OPEN', 20, y);
    }

    // Footer
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(150, 150, 150);
    if (settings.footer) {
      const footerLines = settings.footer.split('\n');
      let footerY = 275;
      footerLines.forEach((line) => {
        doc.text(line, 20, footerY);
        footerY += 5;
      });
    }

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=Factuur-${invoice.invoice_number}.pdf`
      }
    });

  } catch (error) {
    console.error('Generate invoice PDF error:', error);
    return Response.json({ 
      error: error.message || 'Failed to generate PDF' 
    }, { status: 500 });
  }
});