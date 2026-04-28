import { Provider } from "./provider";

export type ProviderKind = "cli" | "mcp" | "http" | "bear";

export interface ProviderConfigBase {
	id: string;
	kind: ProviderKind;
	displayName: string;
	enabled: boolean;
	trusted: boolean;
}

export interface ProviderFactory<C extends ProviderConfigBase = ProviderConfigBase> {
	kind: C["kind"];
	create(config: C): Provider;
}

/**
 * Minimal in-memory registry. Loaded from `data.json` at plugin start;
 * UI mutations write back through the host plugin's `saveData`.
 */
export class ProviderRegistry {
	private readonly factories = new Map<ProviderKind, ProviderFactory>();
	private readonly configs = new Map<string, ProviderConfigBase>();
	private readonly instances = new Map<string, Provider>();

	registerFactory<C extends ProviderConfigBase>(factory: ProviderFactory<C>): void {
		this.factories.set(factory.kind, factory as ProviderFactory);
	}

	loadConfigs(configs: ProviderConfigBase[]): void {
		this.configs.clear();
		this.instances.clear();
		for (const c of configs) this.configs.set(c.id, c);
	}

	listConfigs(): ProviderConfigBase[] {
		return Array.from(this.configs.values());
	}

	getConfig(id: string): ProviderConfigBase | undefined {
		return this.configs.get(id);
	}

	upsertConfig(config: ProviderConfigBase): void {
		this.configs.set(config.id, config);
		this.instances.delete(config.id);
	}

	removeConfig(id: string): void {
		this.configs.delete(id);
		this.instances.delete(id);
	}

	get(id: string): Provider | null {
		const cached = this.instances.get(id);
		if (cached) return cached;
		const cfg = this.configs.get(id);
		if (!cfg || !cfg.enabled || !cfg.trusted) return null;
		const factory = this.factories.get(cfg.kind);
		if (!factory) return null;
		const provider = factory.create(cfg);
		this.instances.set(id, provider);
		return provider;
	}

	listEnabledProviders(): Provider[] {
		const out: Provider[] = [];
		for (const cfg of this.configs.values()) {
			const p = this.get(cfg.id);
			if (p) out.push(p);
		}
		return out;
	}
}
