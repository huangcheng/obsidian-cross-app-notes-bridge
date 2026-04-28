export type EmbedHandling = "drop" | "replace-with-link" | "inline-image-link";
export type AttachmentMode = "vault-relative" | "absolute" | "upload-placeholder";

export interface TransformConfig {
	resolveWikilinks: boolean;
	embedHandling: EmbedHandling;
	flattenCallouts: boolean;
	dropFrontmatter: boolean;
	rewriteAttachments: AttachmentMode;
}

export const DEFAULT_TRANSFORM_CONFIG: TransformConfig = {
	resolveWikilinks: true,
	embedHandling: "replace-with-link",
	flattenCallouts: true,
	dropFrontmatter: false,
	rewriteAttachments: "vault-relative",
};
