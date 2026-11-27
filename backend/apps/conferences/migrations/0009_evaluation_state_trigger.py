from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("conferences", "0008_articlereviewer_evaluation_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql=r"""
            CREATE OR REPLACE FUNCTION sync_article_status_after_evaluation()
            RETURNS TRIGGER AS $$
            DECLARE
                target_article_id bigint;
                target_stage varchar;
                evaluation_count bigint;
                assignment_count bigint;
                has_rejected_or_disapproved boolean;
                all_accepted boolean;
                all_approved boolean;
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    SELECT va.article_id, va.stage
                    INTO target_article_id, target_stage
                    FROM version_articulo va
                    WHERE va.id = OLD.version_id;
                ELSE
                    SELECT va.article_id, va.stage
                    INTO target_article_id, target_stage
                    FROM version_articulo va
                    WHERE va.id = NEW.version_id;
                END IF;

                IF target_article_id IS NULL THEN
                    RETURN NULL;
                END IF;

                SELECT COUNT(*)
                INTO evaluation_count
                FROM evaluacion_jurado ev
                WHERE ev.version_id = COALESCE(
                    NEW.version_id,
                    OLD.version_id
                );

                SELECT COUNT(*)
                INTO assignment_count
                FROM asignacion_jurado ar
                WHERE ar.article_id = target_article_id;

                IF evaluation_count < assignment_count THEN
                    UPDATE articulo
                    SET status = 'EN_REVISION'
                    WHERE id = target_article_id;
                    RETURN NULL;
                END IF;

                SELECT EXISTS (
                    SELECT 1
                    FROM evaluacion_jurado ev
                    WHERE ev.version_id = COALESCE(NEW.version_id, OLD.version_id)
                      AND ev.decision IN ('RECHAZADO', 'NO_AVALADO')
                ) INTO has_rejected_or_disapproved;

                SELECT NOT EXISTS (
                    SELECT 1
                    FROM evaluacion_jurado ev
                    WHERE ev.version_id = COALESCE(NEW.version_id, OLD.version_id)
                      AND ev.decision <> 'ACEPTADO'
                ) INTO all_accepted;

                SELECT NOT EXISTS (
                    SELECT 1
                    FROM evaluacion_jurado ev
                    WHERE ev.version_id = COALESCE(NEW.version_id, OLD.version_id)
                      AND ev.decision <> 'AVALADO'
                ) INTO all_approved;

                IF has_rejected_or_disapproved THEN
                    UPDATE articulo SET status = 'RECHAZADO'
                    WHERE id = target_article_id;
                ELSIF all_accepted THEN
                    UPDATE articulo SET status = 'ACEPTADO'
                    WHERE id = target_article_id;
                ELSIF all_approved THEN
                    IF target_stage = 'FINAL_PUBLICACION' THEN
                        UPDATE articulo SET status = 'AVAL_PUBLICACION'
                        WHERE id = target_article_id;
                    ELSE
                        UPDATE articulo SET status = 'AVAL_PRESENTACION'
                        WHERE id = target_article_id;
                    END IF;
                ELSE
                    UPDATE articulo SET status = 'EN_REVISION'
                    WHERE id = target_article_id;
                END IF;

                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER evaluation_article_status_trigger
            AFTER INSERT OR UPDATE OR DELETE ON evaluacion_jurado
            FOR EACH ROW
            EXECUTE FUNCTION sync_article_status_after_evaluation();
            """,
            reverse_sql=r"""
            DROP TRIGGER IF EXISTS evaluation_article_status_trigger
                ON evaluacion_jurado;
            DROP FUNCTION IF EXISTS sync_article_status_after_evaluation();
            """,
        ),
    ]
