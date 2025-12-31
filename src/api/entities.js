
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

// Proxy that lazily loads the direct client and forwards entity methods transparently
export const entities = new Proxy({}, {
	get(_, entityName) {
		// Return a proxy for the specific entity (e.g., User, Site)
		return new Proxy({}, {
			get(__, methodName) {
				return async (...args) => {
					const direct = await getDirect();
					const entity = direct.entities[entityName];
					if (!entity) throw new Error(`Unknown entity ${String(entityName)}`);
					const method = entity[methodName];
					if (typeof method !== 'function') {
						throw new Error(`Unknown method ${String(methodName)} on entity ${String(entityName)}`);
					}
					return method.apply(entity, args);
				};
			}
		});
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