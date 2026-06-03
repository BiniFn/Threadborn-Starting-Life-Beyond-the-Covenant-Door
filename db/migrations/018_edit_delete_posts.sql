alter table moderation_requests drop constraint if exists moderation_requests_request_type_check;

alter table moderation_requests add constraint moderation_requests_request_type_check check (
  request_type in (
    'profile_update',
    'avatar_update',
    'reader_reaction',
    'community_post',
    'community_comment',
    'community_post_image',
    'banner_update'
  )
);

alter table posts
  add column if not exists is_edited boolean not null default false,
  add column if not exists is_deleted boolean not null default false;

alter table comments
  add column if not exists is_edited boolean not null default false,
  add column if not exists is_deleted boolean not null default false;
