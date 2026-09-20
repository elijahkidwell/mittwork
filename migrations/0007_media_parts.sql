create table if not exists media_parts (
  name text not null,
  idx int not null,
  user_id text not null,
  mime text not null,
  total int not null,
  data bytea not null,
  primary key (name, idx)
);
