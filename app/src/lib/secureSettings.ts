import { createDecipheriv, createCipheriv, randomBytes, createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const MASTER_KEY_ENV = "APP_SECRETS_MASTER_KEY";

function getMasterKey() {
  const raw = process.env[MASTER_KEY_ENV];
  if (!raw) {
    throw new Error(`${MASTER_KEY_ENV} is not configured`);
  }

  const base64Candidate = Buffer.from(raw, "base64");
  if (base64Candidate.length === 32 && base64Candidate.toString("base64") === raw) {
    return base64Candidate;
  }

  const hexCandidate = Buffer.from(raw, "hex");
  if (hexCandidate.length === 32 && hexCandidate.toString("hex") === raw.toLowerCase()) {
    return hexCandidate;
  }

  return createHash("sha256").update(raw).digest();
}

function encryptValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decryptValue(payload: string) {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, getMasterKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export async function getSecureSettingMeta(key: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("secure_settings")
    .select("key, last_four, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error?.message?.includes("secure_settings")) {
    return null;
  }

  if (error) {
    throw error;
  }

  return data;
}

export async function setSecureSetting(input: {
  key: string;
  value: string;
  updatedBy: string;
}) {
  const adminClient = createAdminClient();
  const encryptedValue = encryptValue(input.value);
  const lastFour = input.value.slice(-4);

  const { error } = await adminClient.from("secure_settings").upsert({
    key: input.key,
    encrypted_value: encryptedValue,
    last_four: lastFour,
    updated_by: input.updatedBy,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}

export async function clearSecureSetting(key: string) {
  const adminClient = createAdminClient();
  const { error } = await adminClient.from("secure_settings").delete().eq("key", key);
  if (error) {
    throw error;
  }
}

export async function getSecureSettingValue(key: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("secure_settings")
    .select("encrypted_value")
    .eq("key", key)
    .maybeSingle();

  if (error?.message?.includes("secure_settings")) {
    return null;
  }

  if (error || !data?.encrypted_value) {
    return null;
  }

  return decryptValue(data.encrypted_value);
}
