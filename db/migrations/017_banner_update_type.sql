-- Add banner_update to moderation_requests request_type constraint

alter table moderation_requests drop constraint if exists moderation_requests_request_type_check;

alter table moderation_requests add constraint moderation_requests_request_type_check check (
  request_type in (
    'profile_update',
    'avatar_update',
    'banner_update',
    'reader_reaction',
    'community_post',
    'community_comment'
  )
);
