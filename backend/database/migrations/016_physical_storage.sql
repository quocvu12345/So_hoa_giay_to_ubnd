-- 016 · Kho bản giấy: cây vị trí (kho → phòng → tủ → kệ → hộp), vị trí hồ sơ có lịch sử, mượn trả.
SET search_path = hoso, public, pg_catalog;

CREATE TABLE storage_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES storage_locations(id),
  kind text NOT NULL CHECK (kind IN ('warehouse','room','cabinet','shelf','box')),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9._-]{0,39}$'),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  organization_code text NOT NULL REFERENCES organizations(code),
  -- Nội dung in thành mã QR; không phụ thuộc tên miền nên mã đã dán lên hộp vẫn đúng khi đổi địa chỉ hệ thống.
  qr_payload text NOT NULL UNIQUE,
  capacity_note text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX storage_locations_parent_idx ON storage_locations(parent_id);

-- Cấp con phải thấp hơn cấp cha (kho > phòng > tủ > kệ > hộp) và cùng cơ quan. Cấp luôn tăng nên không thể có vòng.
CREATE FUNCTION storage_location_rank(p_kind text) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_kind WHEN 'warehouse' THEN 1 WHEN 'room' THEN 2 WHEN 'cabinet' THEN 3 WHEN 'shelf' THEN 4 WHEN 'box' THEN 5 END $$;
CREATE FUNCTION storage_location_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent hoso.storage_locations%ROWTYPE;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT * INTO parent FROM hoso.storage_locations WHERE id = NEW.parent_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Parent location not found' USING ERRCODE = 'HS006'; END IF;
    IF parent.organization_code <> NEW.organization_code THEN RAISE EXCEPTION 'Location must belong to the same organization as its parent' USING ERRCODE = 'HS001'; END IF;
    IF hoso.storage_location_rank(NEW.kind) <= hoso.storage_location_rank(parent.kind) THEN
      RAISE EXCEPTION 'A % cannot be placed inside a %', NEW.kind, parent.kind USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER storage_locations_guard BEFORE INSERT OR UPDATE OF parent_id, kind, organization_code ON storage_locations
FOR EACH ROW EXECUTE FUNCTION storage_location_guard();

ALTER TABLE dossiers ADD COLUMN storage_location_id uuid REFERENCES storage_locations(id);
CREATE INDEX dossiers_location_idx ON dossiers(storage_location_id) WHERE storage_location_id IS NOT NULL;

CREATE TABLE dossier_location_moves (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES dossiers(id),
  from_location_id uuid REFERENCES storage_locations(id),
  to_location_id uuid REFERENCES storage_locations(id),
  moved_by uuid REFERENCES users(id),
  moved_at timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL DEFAULT ''
);
CREATE INDEX dossier_location_moves_dossier_idx ON dossier_location_moves(dossier_id, moved_at DESC);
CREATE TRIGGER dossier_location_moves_immutable BEFORE UPDATE OR DELETE ON dossier_location_moves FOR EACH ROW EXECUTE FUNCTION reject_log_mutation();

-- Mỗi lần đổi vị trí ghi một dòng lịch sử. Người thực hiện lấy từ biến phiên hoso.actor_subject; ghi chú từ hoso.move_note (đặt trong giao dịch).
CREATE FUNCTION record_dossier_move() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid;
BEGIN
  BEGIN actor := nullif(current_setting('hoso.actor_subject', true), '')::uuid; EXCEPTION WHEN invalid_text_representation THEN actor := NULL; END;
  INSERT INTO hoso.dossier_location_moves(dossier_id, from_location_id, to_location_id, moved_by, note)
  VALUES (NEW.id, OLD.storage_location_id, NEW.storage_location_id, actor, coalesce(nullif(current_setting('hoso.move_note', true), ''), ''));
  RETURN NULL;
END $$;
CREATE TRIGGER dossiers_location_move AFTER UPDATE OF storage_location_id ON dossiers
FOR EACH ROW WHEN (OLD.storage_location_id IS DISTINCT FROM NEW.storage_location_id) EXECUTE FUNCTION record_dossier_move();

CREATE TABLE loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES dossiers(id),
  borrower_id uuid NOT NULL REFERENCES users(id),
  purpose text NOT NULL CHECK (length(btrim(purpose)) >= 5),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','lent','returned','rejected','overdue')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  due_on date,
  lent_at timestamptz,
  returned_at timestamptz,
  condition_note text NOT NULL DEFAULT '',
  decision_note text NOT NULL DEFAULT '',
  CHECK (status NOT IN ('approved','lent','overdue','returned') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CHECK (status NOT IN ('lent','overdue','returned') OR lent_at IS NOT NULL),
  CHECK ((status = 'returned') = (returned_at IS NOT NULL))
);
-- Một hồ sơ chỉ có một khoản mượn đang có hiệu lực (đã duyệt, đang mượn hoặc quá hạn chưa trả).
CREATE UNIQUE INDEX loans_one_active_per_dossier ON loans(dossier_id) WHERE status IN ('approved','lent','overdue');
CREATE INDEX loans_status_idx ON loans(status, requested_at DESC);
CREATE INDEX loans_borrower_idx ON loans(borrower_id, requested_at DESC);

CREATE TRIGGER storage_locations_audit AFTER INSERT OR UPDATE OR DELETE ON storage_locations FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER loans_audit AFTER INSERT OR UPDATE OR DELETE ON loans FOR EACH ROW EXECUTE FUNCTION audit_change();
