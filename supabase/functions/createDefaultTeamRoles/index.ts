import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_helpers.ts';


Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
    try {
        const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      )
      
      const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return new Response(
        JSON.stringify({ 
                success: false,
                error: 'Unauthorized' 
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        // Parse request body
        const body = await req.json();
        const { team_id } = body;

        if (!team_id) {
            return new Response(
        JSON.stringify({ 
                success: false,
                error: 'team_id is required' 
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        // Check if default roles already exist for this team
        const { data: existingRoles, error: rolesError } = await supabase
            .from('teamroles')
            .select()
            .eq('team_id', team_id)
            .eq('type', 'default');

        if (rolesError || !existingRoles) {
            return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        if (existingRoles.length >= 4) {
            return new Response(
        JSON.stringify({ 
                success: true,
                message: 'Default roles already exist',
                roles: existingRoles
            }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        // Define the 4 default roles (Owner + 3 existing)
        const defaultRoles = [
            {
                team_id: team_id,
                name: "Owner",
                description: "Team eigenaar met volledige controle en alle rechten. Kan niet worden verwijderd of bewerkt.",
                type: "default",
                is_active: true,
                permissions: {
                    sites: {
                        view: true,
                        create: true,
                        edit: true,
                        delete: true,
                        share: true,
                        manage_plugins: true
                    },
                    plugins: {
                        view: true,
                        create: true,
                        edit: true,
                        delete: true,
                        share: true,
                        install: true,
                        uninstall: true,
                        activate: true,
                        deactivate: true,
                        manage_versions: true
                    },
                    members: {
                        view: true,
                        invite: true,
                        edit: true,
                        remove: true,
                        manage_roles: true
                    },
                    team: {
                        view: true,
                        edit_settings: true,
                        manage_roles: true
                    }
                }
            },
            {
                team_id: team_id,
                name: "Admin",
                description: "Alle rechten van een Manager, plus het beheren van custom team rollen en team instellingen.",
                type: "default",
                is_active: true,
                permissions: {
                    sites: {
                        view: true,
                        create: true,
                        edit: true,
                        delete: true,
                        share: true,
                        manage_plugins: true
                    },
                    plugins: {
                        view: true,
                        create: true,
                        edit: true,
                        delete: true,
                        share: true,
                        install: true,
                        uninstall: true,
                        activate: true,
                        deactivate: true,
                        manage_versions: true
                    },
                    members: {
                        view: true,
                        invite: true,
                        edit: true,
                        remove: true,
                        manage_roles: true
                    },
                    team: {
                        view: true,
                        edit_settings: true,
                        manage_roles: true
                    }
                }
            },
            {
                team_id: team_id,
                name: "Manager",
                description: "Alle rechten van een Member, plus het beheren van team sites en plugins, en teamleden.",
                type: "default",
                is_active: true,
                permissions: {
                    sites: {
                        view: true,
                        create: true,
                        edit: true,
                        delete: true,
                        share: true,
                        manage_plugins: true
                    },
                    plugins: {
                        view: true,
                        create: true,
                        edit: true,
                        delete: true,
                        share: true,
                        install: true,
                        uninstall: true,
                        activate: true,
                        deactivate: true,
                        manage_versions: false
                    },
                    members: {
                        view: true,
                        invite: true,
                        edit: true,
                        remove: true,
                        manage_roles: false
                    },
                    team: {
                        view: true,
                        edit_settings: false,
                        manage_roles: false
                    }
                }
            },
            {
                team_id: team_id,
                name: "Member",
                description: "Kan team plugins en sites bekijken, en plugins activeren/deactiveren/updaten op teamsites.",
                type: "default",
                is_active: true,
                permissions: {
                    sites: {
                        view: true,
                        create: false,
                        edit: false,
                        delete: false,
                        share: false,
                        manage_plugins: true
                    },
                    plugins: {
                        view: true,
                        create: false,
                        edit: false,
                        delete: false,
                        share: false,
                        install: false,
                        uninstall: false,
                        activate: true,
                        deactivate: true,
                        manage_versions: false
                    },
                    members: {
                        view: true,
                        invite: false,
                        edit: false,
                        remove: false,
                        manage_roles: false
                    },
                    team: {
                        view: true,
                        edit_settings: false,
                        manage_roles: false
                    }
                }
            }
        ];

        // Create the roles
        const createdRoles = [];
        for (const roleData of defaultRoles) {
            const { data: role, error: roleError } = await supabase.from('teamroles').insert(roleData);
            createdRoles.push(role);
        }

        return new Response(
        JSON.stringify({
            success: true,
            message: 'Default team roles created successfully',
            roles: createdRoles
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('[createDefaultTeamRoles] Error:', error.message);
        return new Response(
        JSON.stringify({ 
            success: false,
            error: error.message 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});