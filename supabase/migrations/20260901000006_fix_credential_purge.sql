-- 20260901000005의 파기 배치 수정.
--
-- 무엇이 틀렸나
--   000005의 purge_expired_credentials()는 storage.objects에서 행을 직접 DELETE 했다.
--   Supabase에는 storage.protect_delete() 트리거가 있어 이 삭제를 차단한다:
--     "Direct deletion from storage tables is not allowed. Use the Storage API instead."
--   따라서 배치는 매일 04:00 UTC에 실패하고 있었다.
--
-- 왜 우회하지 않는가
--   트리거는 current_setting('storage.allow_delete_query')='true'면 통과한다.
--   그러나 그 경로로 행만 지우면 S3에 실제 이미지 바이트가 고아로 남는다.
--   "검증 후 원본 파기"가 목적인데 겉으로만 지워지고 원본이 남으면 요구사항을
--   만족시킨 척하는 것이 되므로 쓰지 않는다. Storage API로 실제 삭제한다.
--
-- 어떻게 고치나
--   pg_net으로 Storage API의 DELETE /storage/v1/object/credentials/{path}를 호출한다.
--   호출에는 service_role 키가 필요하고, 키는 Supabase Vault에 둔다.
--
--   ※ 배포 전 1회만, 프로젝트 소유자가 직접 실행해야 한다:
--       select vault.create_secret('<service_role 키>', 'service_role_key',
--                                  'purge_expired_credentials 의 Storage API 호출용');
--     키가 없으면 배치는 조용히 넘어가지 않고 예외를 던진다 —
--     파기가 안 되고 있는 상태를 모르고 지나가는 것이 가장 위험하기 때문이다.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.purge_expired_credentials()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  svc_key text;
  base_url text;
  r record;
  n int := 0;
BEGIN
  SELECT decrypted_secret INTO svc_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF svc_key IS NULL THEN
    RAISE EXCEPTION
      'vault에 service_role_key가 없어 증빙 원본을 파기할 수 없습니다. '
      'vault.create_secret(<키>, ''service_role_key'') 를 먼저 실행하세요.';
  END IF;

  base_url := 'https://syxodrmnukybnnlgttuw.supabase.co/storage/v1/object/credentials/';

  FOR r IN
    SELECT id, user_id FROM public.profile_credentials
    WHERE purge_after IS NOT NULL AND purge_after < now()
  LOOP
    -- pg_net은 비동기 큐잉이다. 야간 배치이므로 응답을 기다릴 필요가 없다.
    PERFORM net.http_delete(
      url     := base_url || r.user_id::text || '/' || r.id::text,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || svc_key,
        'apikey', svc_key
      )
    );
    n := n + 1;
  END LOOP;

  -- 파기 요청을 보낸 건만 완료 표시 (다음 배치에서 다시 잡히지 않도록)
  UPDATE public.profile_credentials
  SET purge_after = NULL
  WHERE purge_after IS NOT NULL AND purge_after < now();

  RETURN n;
END;
$$;

-- ROLLBACK:
--   20260901000005 의 purge_expired_credentials() 정의로 되돌린다.
--   (단 그 버전은 storage.protect_delete 에 막혀 동작하지 않는다)
--   DROP EXTENSION IF EXISTS pg_net;
--   SELECT vault.delete_secret('service_role_key');
