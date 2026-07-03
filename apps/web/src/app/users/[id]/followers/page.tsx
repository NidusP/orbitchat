import { UserConnectionList } from '@/components/user-connection-list';

interface FollowersPageProps {
  params: Promise<{ id: string }>;
}

export default async function FollowersPage({ params }: FollowersPageProps) {
  const { id } = await params;
  return <UserConnectionList userId={id} mode="followers" />;
}
