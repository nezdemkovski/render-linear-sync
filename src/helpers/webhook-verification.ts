export const verifyWebhookSignature = async (
  payload: string,
  signature: string | null,
  webhookId: string | null,
  webhookTimestamp: string | null,
  secret: string
): Promise<boolean> => {
  if (!signature || !secret || !webhookId || !webhookTimestamp) {
    return false;
  }

  try {
    const signedPayload = `${webhookId}.${webhookTimestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const providedSignature = signature.toLowerCase();
    const computedSignatureLower = computedSignature.toLowerCase();

    return providedSignature === computedSignatureLower;
  } catch {
    return false;
  }
};
