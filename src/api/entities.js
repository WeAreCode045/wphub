
import { getSupabase } from './getSupabase';

let _directClient = null;
async function getDirect() {
	if (!_directClient) {
		const mod = await import('./supabaseClient');
		_directClient = mod.supabaseClientDirect;
	}
	return _directClient;
}

// Lazily-proxied exports that defer loading the heavy client until first use.
export const Query = {
	run: async (...args) => {
		const direct = await getDirect();
		return direct.Query.run(...args);
	}
};

export const User = {
	me: async () => (await getDirect()).auth.me(),
	updateMe: async (data) => (await getDirect()).auth.updateMe(data),
	logout: async () => (await getDirect()).auth.logout(),
};

export const entities = new Proxy({}, {
	get(_, prop) {
		return async function proxyEntityMethod(...args) {
			const direct = await getDirect();
			const entity = direct.entities[prop];
			if (!entity) throw new Error(`Unknown entity ${String(prop)}`);
			// If called as entity.method, forward accordingly
			if (args.length === 1 && typeof args[0] === 'object' && entity.list) {
				return entity.list(...args);
			}
			// For specific methods, assume caller will access the method on returned object
			return entity;
		};
	}
});

export const functions = {
	invoke: async (name, payload = {}) => {
		const direct = await getDirect();
		return direct.functions.invoke(name, payload);
	}
};

export const integrations = {
	Core: {
		UploadFile: async (opts) => {
			const direct = await getDirect();
			return direct.integrations.Core.UploadFile(opts);
		}
	}
};

export const auth = {
	signUpWithProfile: async (...args) => {
		const direct = await getDirect();
		return direct.auth.signUpWithProfile ? direct.auth.signUpWithProfile(...args) : null;
	}
};