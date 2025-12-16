import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Download,
  Loader2,
  FileText,
  Calendar,
  CreditCard,
  CheckCircle,
  MapPin,
  Receipt
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";

export default function InvoiceDetail() {
  const [user, setUser] = useState(null);
  const { toast } = useToast();

  const urlParams = new URLSearchParams(window.location.search);
  const invoiceId = urlParams.get("id");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => base44.entities.Invoice.get(invoiceId),
    enabled: !!invoiceId,
  });

  const downloadPDFMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('generateInvoicePDF', {
        invoice_id: invoiceId
      });
      return response.data;
    },
    onSuccess: (data) => {
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Factuur-${invoice?.invoice_number || invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij downloaden",
        description: error.message,
      });
    }
  });

  const formatPrice = (amountInCents, currency = "EUR") => {
    const amount = amountInCents / 100;
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Factuur niet gevonden</h2>
            <p className="text-gray-600 mb-6">De factuur die je zoekt bestaat niet of je hebt geen toegang.</p>
            <Button asChild>
              <Link to={createPageUrl("MySubscription")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Terug naar Abonnement
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 bg-gray-50 min-h-full">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" asChild>
            <Link to={createPageUrl("MySubscription")}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Factuur Details</h1>
            <p className="text-gray-600 mt-1">{invoice.invoice_number}</p>
          </div>
          <Button
            onClick={() => downloadPDFMutation.mutate()}
            disabled={downloadPDFMutation.isPending}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
          >
            {downloadPDFMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Genereren...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </>
            )}
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Invoice Card */}
          <Card className="lg:col-span-2 border-none shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl mb-2">Factuur {invoice.invoice_number}</CardTitle>
                  <Badge className={
                    invoice.status === 'paid' 
                      ? 'bg-green-100 text-green-700 border-green-200' 
                      : invoice.status === 'open'
                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                  }>
                    {invoice.status === 'paid' ? 'Betaald' : invoice.status === 'open' ? 'Open' : invoice.status}
                  </Badge>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Receipt className="w-8 h-8 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Customer Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Klantgegevens</h3>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <p className="text-sm">
                    <span className="text-gray-600">Naam:</span>{' '}
                    <span className="font-medium text-gray-900">{invoice.user_name}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-600">Email:</span>{' '}
                    <span className="font-medium text-gray-900">{invoice.user_email}</span>
                  </p>
                  {invoice.billing_address && invoice.billing_address.line1 && (
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Factuuradres
                      </p>
                      <p className="text-sm text-gray-900">{invoice.billing_address.line1}</p>
                      {invoice.billing_address.line2 && (
                        <p className="text-sm text-gray-900">{invoice.billing_address.line2}</p>
                      )}
                      <p className="text-sm text-gray-900">
                        {invoice.billing_address.postal_code} {invoice.billing_address.city}
                      </p>
                      {invoice.billing_address.country && (
                        <p className="text-sm text-gray-900">{invoice.billing_address.country}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Items */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Factuurgegevens</h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Omschrijving
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Bedrag
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-4">
                          <p className="font-medium text-gray-900">{invoice.description || invoice.plan_name}</p>
                          {invoice.period_start && invoice.period_end && (
                            <p className="text-sm text-gray-600 mt-1">
                              {format(new Date(invoice.period_start), "d MMM yyyy", { locale: nl })} - {format(new Date(invoice.period_end), "d MMM yyyy", { locale: nl })}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right font-medium text-gray-900">
                          {formatPrice(invoice.subtotal, invoice.currency)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Subtotaal</span>
                  <span className="font-medium text-gray-900">
                    {formatPrice(invoice.subtotal, invoice.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">BTW ({invoice.vat_percentage}%)</span>
                  <span className="font-medium text-gray-900">
                    {formatPrice(invoice.vat_amount, invoice.currency)}
                  </span>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-gray-900">Totaal</span>
                    <span className="text-2xl font-bold text-gray-900">
                      {formatPrice(invoice.amount, invoice.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {invoice.status === 'paid' && invoice.paid_at && (
                  <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-green-900 text-sm">Betaald</p>
                      <p className="text-xs text-green-700 mt-1">
                        {format(new Date(invoice.paid_at), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
                      </p>
                    </div>
                  </div>
                )}
                {invoice.status === 'open' && invoice.due_date && (
                  <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <Calendar className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900 text-sm">Open</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Vervalt op {format(new Date(invoice.due_date), "d MMMM yyyy", { locale: nl })}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Details Card */}
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Factuurnummer
                  </p>
                  <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Factuurdatum
                  </p>
                  <p className="font-medium text-gray-900">
                    {format(new Date(invoice.created_date), "d MMMM yyyy", { locale: nl })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    Abonnement
                  </p>
                  <p className="font-medium text-gray-900">{invoice.plan_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {invoice.billing_period === 'month' ? 'Maandelijks' : 'Jaarlijks'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}