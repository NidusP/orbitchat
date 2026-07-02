import { UserConnectionList } from '@/components/user-connection-list';

interface FollowingPageProps {
  params: Promise<{ id: string }>;
}

export default async function FollowingPage({ params }: FollowingPageProps) {
  const { id } = await params;
  return <UserConnectionList userId={id} mode="following" />;
}
