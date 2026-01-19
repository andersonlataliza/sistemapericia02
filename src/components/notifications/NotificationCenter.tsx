import { useState } from 'react';
import { Bell, Check, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotificationContext } from './NotificationProvider';
import { cn } from '@/lib/utils';

interface NotificationCenterProps {
  className?: string;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'urgent':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'warning':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case 'urgent':
      return 'border-l-red-500 bg-red-50';
    case 'warning':
      return 'border-l-yellow-500 bg-yellow-50';
    case 'success':
      return 'border-l-green-500 bg-green-50';
    default:
      return 'border-l-blue-500 bg-blue-50';
  }
};

export default function NotificationCenter({ className }: NotificationCenterProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationContext();
  const [isOpen, setIsOpen] = useState(false);

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("relative", className)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notificações</CardTitle>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="text-xs"
                >
                  Marcar todas como lidas
                </Button>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <ScrollArea className="h-96">
              {!notifications || notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma notificação
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-3 border-l-4 transition-colors hover:bg-muted/50",
                        getNotificationColor(notification.type),
                        !notification.isRead && "bg-opacity-100"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {getNotificationIcon(notification.type)}
                        
                        <div className="flex-1 space-y-1">
                          <p className={cn(
                            "text-sm leading-relaxed",
                            !notification.isRead && "font-medium"
                          )}>
                            {notification.message}
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                              {new Date(notification.createdAt).toLocaleString('pt-BR')}
                            </p>
                            
                            {!notification.isRead && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="h-6 w-6 p-0"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}