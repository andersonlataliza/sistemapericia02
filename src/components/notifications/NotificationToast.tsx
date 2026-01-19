import { useEffect, useState } from 'react';
import { AlertCircle, Info, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNotificationContext } from './NotificationProvider';

interface NotificationToastProps {
  enabled?: boolean;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'urgent':
      return <AlertCircle className="h-4 w-4" />;
    case 'warning':
      return <AlertCircle className="h-4 w-4" />;
    case 'success':
      return <CheckCircle className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
};

const getNotificationVariant = (type: string) => {
  switch (type) {
    case 'urgent':
      return 'destructive';
    case 'warning':
      return 'default';
    case 'success':
      return 'default';
    default:
      return 'default';
  }
};

export default function NotificationToast({ enabled = true }: NotificationToastProps) {
  const { toast } = useToast();
  const { notifications } = useNotificationContext();
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !notifications || notifications.length === 0) return;

    // Pega a notificação mais recente não lida
    const recentUnreadNotifications = notifications
      .filter(n => !n.isRead)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (recentUnreadNotifications.length === 0) return;

    const mostRecent = recentUnreadNotifications[0];
    
    // Evita mostrar a mesma notificação múltiplas vezes
    if (mostRecent.id === lastNotificationId) return;

    setLastNotificationId(mostRecent.id);

    if (recentUnreadNotifications.length > 0) {
      const latestNotification = recentUnreadNotifications[0];
      
      toast({
        title: "Nova Notificação",
        description: latestNotification.message,
        variant: getNotificationVariant(latestNotification.type) as any,
        duration: 5000,
        action: (
          <div className="flex items-center">
            {getNotificationIcon(latestNotification.type)}
          </div>
        ),
      });
    }
  }, [notifications, toast, enabled, lastNotificationId]);

  return null; // Este componente não renderiza nada visualmente
}