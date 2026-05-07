-- Create backup_code table to track individual backup codes and their usage
CREATE TABLE backup_code (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_identity_id UUID NOT NULL REFERENCES user_identity(id) ON DELETE CASCADE,
  code_hash VARCHAR(255) NOT NULL,
  used_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate codes for the same user
  CONSTRAINT unique_code_per_user UNIQUE (user_identity_id, code_hash)
);

-- Create indexes for faster lookups
CREATE INDEX idx_backup_code_user_id ON backup_code(user_identity_id);
CREATE INDEX idx_backup_code_user_id_used_at ON backup_code(user_identity_id, used_at) WHERE used_at IS NULL;

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_backup_code_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER backup_code_updated_at BEFORE UPDATE ON backup_code
  FOR EACH ROW EXECUTE FUNCTION update_backup_code_updated_at();

