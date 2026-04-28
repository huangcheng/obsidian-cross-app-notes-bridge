import { ProviderConfigBase } from "../providers/registry";
import { DEFAULT_TRANSFORM_CONFIG, TransformConfig } from "../transforms/config";

export interface PluginSettings {
	transform: TransformConfig;
	defaultExportDir: string;
	defaultImportDir: string;
	concurrency: number;
	developerLog: boolean;
	providers: ProviderConfigBase[];
}

export const DEFAULT_SETTINGS: PluginSettings = {
	transform: { ...DEFAULT_TRANSFORM_CONFIG },
	defaultExportDir: "Exports",
	defaultImportDir: "Imports",
	concurrency: 4,
	developerLog: false,
	providers: [],
};
