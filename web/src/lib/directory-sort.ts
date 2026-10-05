/** The orders a public directory can be read in; the first is the one it opens with. */
export const directorySorts = ["newest", "name"] as const;

export type DirectorySort = (typeof directorySorts)[number];
