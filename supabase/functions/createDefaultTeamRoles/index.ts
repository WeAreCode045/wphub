import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ 
                success: false,
                error: 'Unauthorized' 
            }, { status: 401 });
        }

        // Parse request body
        const body = await req.json();
        const { team_id } = body;

        if (!team_id) {
            return Response.json({ 
                success: false,
                error: 'team_id is required' 
            }, { status: 400 });
        }

        // Check if default roles already exist for this team
        const existingRoles = await base44.entities.TeamRole.filter({ 
            team_id: team_id,
            type: "default"
        });

        if (existingRoles.length >= 4) {
            return Response.json({ 
                success: true,
                message: 'Default roles already exist',
                roles: existingRoles
            });
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
            const role = await base44.entities.TeamRole.create(roleData);
            createdRoles.push(role);
        }

        return Response.json({
            success: true,
            message: 'Default team roles created successfully',
            roles: createdRoles
        });

    } catch (error) {
        console.error('[createDefaultTeamRoles] Error:', error.message);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});