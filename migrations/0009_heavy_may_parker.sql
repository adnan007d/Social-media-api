-- Custom SQL migration file, put you code below! --
CREATE TRIGGER posts_updated_at_trigger
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER likes_updated_at_trigger
BEFORE UPDATE ON likes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER comments_updated_at_trigger
BEFORE UPDATE ON comments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
