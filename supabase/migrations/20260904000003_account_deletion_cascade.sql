-- 계정을 지워도 데이터가 남던 문제.
--
-- posts·post_comments·post_likes·messages·conversations·notifications·job_applications·
-- room_reservations·push_subscriptions의 사용자 컬럼에는 auth.users 외래키가 아예 없었다.
-- 그래서 계정을 지워도 아무것도 따라 지워지지 않았고, 개인정보처리방침이 약속한
-- "계정 삭제 시 처리"가 실제로는 이뤄지지 않았다.
--
-- 두 가지로 나눠 건다.
--   ① 본인이 만든 것(글·댓글·좋아요·알림·지원·예약·푸시구독) → CASCADE. 함께 사라진다.
--   ② 주고받은 것(메시지·대화) → SET NULL. 행은 남기고 신원만 끊는다.
--
-- ②를 CASCADE로 걸면 상대방의 대화 기록까지 함께 사라진다. 내가 계정을 지웠다는 이유로
-- 남이 나눈 말까지 지워지는 것은 남은 사람의 기록을 뺏는 일이다. 화면은 NULL을
-- '탈퇴한 사용자'로 그린다.
--
-- RLS는 NULL에 안전한 것을 확인했다. conversations 정책은 `auth.uid() = user1_id OR
-- auth.uid() = user2_id`라 한쪽이 NULL이 되어도 남은 쪽만 통과하고, messages INSERT는
-- `auth.uid() = sender_id`라 NULL 발신자를 만들 수 없다.

-- ────────────────────────────────────────────────────────────────
-- 1. 익명화 대상 컬럼에 NULL을 허용한다
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.messages      ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN user1_id  DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN user2_id  DROP NOT NULL;

-- 대화방 중복을 막는 유니크 인덱스를 '살아 있는 두 사람'에게만 적용한다.
--
-- LEAST/GREATEST는 NULL을 값으로 세지 않고 무시한다. 그래서 한쪽을 NULL로 돌리면
-- (NULL, 나) 짜리 대화가 전부 (나, 나)라는 같은 키로 접혀 서로 충돌한다. 실제로
-- 이 마이그레이션의 첫 시도가 여기서 막혔다 — 한 사람이 이미 탈퇴한 두 명과
-- 각각 대화한 적이 있었기 때문이다.
--
-- 이 인덱스가 원래 막으려던 것은 "살아 있는 두 사람 사이에 방이 두 개 생기는 일"이다.
-- 한쪽이 떠난 방은 새로 만들 수 있는 방이 아니라 지난 기록이고, 그런 기록이 여럿인 것은
-- 중복이 아니라 서로 다른 사람과의 서로 다른 대화다. 그래서 둘 다 살아 있을 때만 본다.
--
-- 새 대화는 언제나 두 id가 채워진 채 만들어지므로 중복 방지는 그대로 작동한다.
-- 코드는 ON CONFLICT가 아니라 23505 오류를 잡아 기존 방을 되찾는 방식이라(Messages.tsx)
-- 인덱스 이름이나 형태에 기대지 않는다.
DROP INDEX IF EXISTS public.uniq_conversation_pair;
CREATE UNIQUE INDEX uniq_conversation_pair
  ON public.conversations (LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id))
  WHERE user1_id IS NOT NULL AND user2_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- 2. 이미 주인이 사라진 행을 정리한다
--
-- 외래키를 걸려면 남아 있는 행이 모두 유효해야 한다. 여기서 지우는 것은 외래키가
-- 있었다면 그때 함께 지워졌을 것들이다 — QA·보안 점검 때 만든 계정의 잔해이고,
-- 그중 일부(커뮤니티 3건·연습실 2건·구인 4건)는 지금 라이브 목록에 노출돼 있다.
-- ────────────────────────────────────────────────────────────────

-- 메시지·대화는 지우지 않고 신원만 끊는다(위 ②와 같은 처리)
UPDATE public.messages m SET sender_id = NULL
 WHERE m.sender_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.sender_id);

UPDATE public.conversations c SET user1_id = NULL
 WHERE c.user1_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.user1_id);

UPDATE public.conversations c SET user2_id = NULL
 WHERE c.user2_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.user2_id);

-- 유령 글에 달린 남의 댓글·좋아요를 먼저 정리한다. 글을 지우면 따라 지워지겠지만,
-- 그 연결이 CASCADE인지 여기서 확신할 수 없으므로 순서로 보장한다.
DELETE FROM public.post_likes    WHERE post_id IN (SELECT id FROM public.posts p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id));
DELETE FROM public.post_comments WHERE post_id IN (SELECT id FROM public.posts p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id));

DELETE FROM public.post_likes         p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);
DELETE FROM public.post_comments      p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);
DELETE FROM public.posts              p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);
DELETE FROM public.notifications      p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);
DELETE FROM public.job_applications   p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);
DELETE FROM public.push_subscriptions p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);
DELETE FROM public.room_reservations  p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);

-- ────────────────────────────────────────────────────────────────
-- 3. 외래키를 건다
--
-- 이름이 이미 있으면 건너뛴다 — 다시 돌려도 안전해야 한다.
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  spec record;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('posts',              'user_id',   'CASCADE'),
      ('post_comments',      'user_id',   'CASCADE'),
      ('post_likes',         'user_id',   'CASCADE'),
      ('notifications',      'user_id',   'CASCADE'),
      ('job_applications',   'user_id',   'CASCADE'),
      ('push_subscriptions', 'user_id',   'CASCADE'),
      ('room_reservations',  'user_id',   'CASCADE'),
      ('messages',           'sender_id', 'SET NULL'),
      ('conversations',      'user1_id',  'SET NULL'),
      ('conversations',      'user2_id',  'SET NULL')
    ) AS t(tbl, col, act)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = format('%s_%s_fkey', spec.tbl, spec.col)
        AND conrelid = format('public.%I', spec.tbl)::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE %s',
        spec.tbl, format('%s_%s_fkey', spec.tbl, spec.col), spec.col, spec.act
      );
    END IF;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 4. 두 사람 모두 떠난 대화는 지운다
--
-- 한쪽만 떠난 대화는 남은 사람의 기록이라 지키는 것이 이 마이그레이션의 요지지만,
-- 양쪽이 모두 떠나면 지킬 사람이 없다. RLS가 `auth.uid() = user1_id OR = user2_id`라
-- 아무도 읽을 수 없게 되는데, 읽을 수 없는 대화 내용을 계속 들고 있을 이유는 없다.
-- 목적이 사라진 개인정보는 남겨두는 것 자체가 위험이다.
-- ────────────────────────────────────────────────────────────────
DELETE FROM public.conversations WHERE user1_id IS NULL AND user2_id IS NULL;

CREATE OR REPLACE FUNCTION public.drop_orphan_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user1_id IS NULL AND NEW.user2_id IS NULL THEN
    DELETE FROM public.conversations WHERE id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS conversations_drop_when_empty ON public.conversations;
CREATE TRIGGER conversations_drop_when_empty
AFTER UPDATE OF user1_id, user2_id ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.drop_orphan_conversation();
