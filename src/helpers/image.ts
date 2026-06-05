export interface ImageCommitRef {
  owner: string;
  repo: string;
  commitId: string;
}

export const parseImageCommitRef = (
  imageRef: string | undefined
): ImageCommitRef | null => {
  if (!imageRef) {
    return null;
  }

  const match = imageRef.match(
    /^ghcr\.io\/([^/]+)\/([^:@]+):([0-9a-f]{40})$/i
  );
  if (!match || !match[1] || !match[2] || !match[3]) {
    return null;
  }

  return {
    owner: match[1],
    repo: match[2],
    commitId: match[3].toLowerCase(),
  };
};
