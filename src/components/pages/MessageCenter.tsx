'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Check, Eye, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { formatChinaDateTime } from '@/lib/china-time';

interface Message {
  id: number;
  type: string;
  title: string;
  content: string;
  related_type: string | null;
  related_id: number | null;
  is_read: boolean;
  created_at: string;
}

export default function MessageCenter() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const fetchMessages = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/messages', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('获取消息失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const markAsRead = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/messages/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        fetchMessages();
      }
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/messages/read-all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        fetchMessages();
      }
    } catch (error) {
      console.error('标记全部已读失败:', error);
    }
  };

  const deleteMessage = async (id: number) => {
    if (!confirm('确定要删除这条消息吗？')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/messages/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        fetchMessages();
      }
    } catch (error) {
      console.error('删除消息失败:', error);
    }
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'approval': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'system': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'approval': return '待审批';
      case 'approved': return '已通过';
      case 'rejected': return '已驳回';
      case 'system': return '系统';
      default: return '通知';
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !msg.is_read;
    return msg.type === activeTab;
  });

  const unreadCount = messages.filter(m => !m.is_read).length;

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center h-20">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5" />
          消息通知
          {unreadCount > 0 && (
            <Badge className="bg-red-500">{unreadCount}</Badge>
          )}
        </h3>
        {unreadCount > 0 && (
          <Button size="sm" variant="ghost" onClick={markAllAsRead}>
            全部已读
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">全部</TabsTrigger>
          <TabsTrigger value="unread" className="flex-1">
            未读
            {unreadCount > 0 && (
              <Badge className="ml-1 bg-red-500 text-xs">{unreadCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <ScrollArea className="h-[300px]">
            <div className="space-y-2 py-2">
              {filteredMessages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  暂无消息
                </div>
              ) : (
                filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg border ${!msg.is_read ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <Badge className={getTypeStyle(msg.type)}>
                          {getTypeName(msg.type)}
                        </Badge>
                        <span className="font-medium text-sm">{msg.title}</span>
                        {!msg.is_read && (
                          <span className="w-2 h-2 bg-red-500 rounded-full" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatChinaDateTime(msg.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{msg.content}</p>
                    <div className="flex justify-end gap-2">
                      {msg.related_type && msg.related_id && (
                        <Link href={`/${msg.related_type === 'purchase_request' ? 'purchase-requests' : 'expense-claims'}?id=${msg.related_id}`}>
                          <Button size="sm" variant="outline">
                            <Eye className="w-3 h-3 mr-1" />
                            查看
                          </Button>
                        </Link>
                      )}
                      {!msg.is_read && (
                        <Button size="sm" variant="ghost" onClick={() => markAsRead(msg.id)}>
                          <Check className="w-3 h-3 mr-1" />
                          已读
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteMessage(msg.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
