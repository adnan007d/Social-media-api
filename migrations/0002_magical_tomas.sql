-- Custom SQL migration file, put you code below! --
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE OR REPLACE FUNCTION update_updated_at_expire_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.expires_at = now() + INTERVAL '30 days';
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER users_updated_at_trigger
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER images_updated_at_trigger
BEFORE UPDATE ON images
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER refresh_tokens_updated_at_trigger
BEFORE UPDATE ON refresh_tokens
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_expire_at_column();
