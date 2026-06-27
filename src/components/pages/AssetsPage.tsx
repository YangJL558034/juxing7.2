'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Loader2, QrCode, Pencil, Trash2, Archive, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { chinaToday } from '@/lib/china-time';

// 资产类型选项
const assetTypes = [
  { value: '电脑', label: '电脑' },
  { value: '笔记本电脑', label: '笔记本电脑' },
  { value: '显示器', label: '显示器' },
  { value: '手机', label: '手机' },
  { value: '苹果平板电脑', label: '苹果平板电脑' },
  { value: '安卓平板电脑', label: '安卓平板电脑' },
  { value: '安卓生产看板', label: '安卓生产看板' },
  { value: '电视机', label: '电视机' },
  { value: '路由器', label: '路由器' },
  { value: '大疆设备', label: '大疆设备' },
  { value: '扫码枪', label: '扫码枪' },
  { value: '空调遥控器', label: '空调遥控器' },
  { value: '自定义', label: '自定义' },
];

interface AssetConfig {
  cpu?: string;
  memory?: string;
  gpu?: string;
  storage?: string;
  monitor?: string;
  system?: string;
}

interface Asset {
  id: number;
  name: string;
  type: string;
  department: string;
  user: string;
  status: string;
  value: number;
  purchase_date: string;
  config?: AssetConfig;
  created_at: string;
  scrap_time?: string;
  scrap_confirmer?: string;
  claim_time?: string;
}

interface AssetsPageProps {
  selectedType?: string;
}

export function AssetsPage({ selectedType = 'all' }: AssetsPageProps) {
  const [assetList, setAssetList] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [qrCodeData, setQRCodeData] = useState<{ qrCode: string; url: string } | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  
  // 报废确认对话框状态
  const [scrapDialogOpen, setScrapDialogOpen] = useState(false);
  const [scrapAssetId, setScrapAssetId] = useState<number | null>(null);
  const [scrapConfirmer, setScrapConfirmer] = useState('');
  const [customAssetType, setCustomAssetType] = useState('');
  const [downloadingQRCodes, setDownloadingQRCodes] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkCustomAssetType, setBulkCustomAssetType] = useState('');
  const [bulkAsset, setBulkAsset] = useState({
    type: '电脑',
    namePrefix: '资产',
    department: '',
    user: '',
    value: '0',
    purchase_date: chinaToday(),
    count: '10',
    startNumber: '1',
  });
  
  const [newAsset, setNewAsset] = useState({
    name: '',
    type: '电脑',
    department: '',
    user: '',
    value: '',
    purchase_date: chinaToday(),
    config: {} as AssetConfig,
  });

  const fetchAssets = async () => {
    try {
      const response = await fetch('/api/assets');
      const data = await response.json();
      if (data.success) {
        setAssetList(data.data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('assets-updated'));
        }
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载资产数据
  useEffect(() => {
    fetchAssets();
  }, []);

  useEffect(() => {
    setFilterType(selectedType || 'all');
  }, [selectedType]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case '使用中':
        return 'default';
      case '闲置':
        return 'secondary';
      case '维修中':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // 生成二维码
  const handleShowQRCode = async (assetId: number) => {
    try {
      const response = await fetch(`/api/assets/qrcode?id=${assetId}`);
      const data = await response.json();
      if (data.success) {
        setQRCodeData(data.data);
        setIsQRDialogOpen(true);
      }
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  };

  const handleDownloadAllQRCodes = async () => {
    if (assetList.length === 0) {
      alert('暂无资产二维码可下载');
      return;
    }

    setDownloadingQRCodes(true);
    try {
      const response = await fetch('/api/assets/qrcode/batch');
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        alert(error.error || '下载全部资产二维码失败');
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/);
      const fileName = filenameMatch
        ? decodeURIComponent(filenameMatch[1] || filenameMatch[2])
        : `资产二维码_${chinaToday()}.zip`;

      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download asset QR codes:', error);
      alert('下载全部资产二维码失败');
    } finally {
      setDownloadingQRCodes(false);
    }
  };

  const resetBulkAsset = () => {
    setBulkCustomAssetType('');
    setBulkAsset({
      type: '电脑',
      namePrefix: '资产',
      department: '',
      user: '',
      value: '0',
      purchase_date: chinaToday(),
      count: '10',
      startNumber: '1',
    });
  };

  const handleBulkGenerateAssets = async () => {
    const assetType = bulkAsset.type === '自定义' && bulkCustomAssetType.trim()
      ? bulkCustomAssetType.trim()
      : bulkAsset.type;

    if (!assetType || !bulkAsset.namePrefix.trim() || !bulkAsset.department.trim()) {
      alert('请填写资产类型、名称前缀和所属部门');
      return;
    }

    setBulkGenerating(true);
    try {
      const response = await fetch('/api/assets/bulk-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: assetType,
          namePrefix: bulkAsset.namePrefix.trim(),
          department: bulkAsset.department.trim(),
          user: bulkAsset.user.trim() || null,
          value: bulkAsset.value,
          purchase_date: bulkAsset.purchase_date,
          count: bulkAsset.count,
          startNumber: bulkAsset.startNumber,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        alert(data.error || '一键生成资产失败');
        return;
      }

      setBulkDialogOpen(false);
      resetBulkAsset();
      await fetchAssets();
    } catch (error) {
      console.error('Failed to bulk generate assets:', error);
      alert('一键生成资产失败');
    } finally {
      setBulkGenerating(false);
    }
  };

  // 编辑资产
  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setNewAsset({
      name: asset.name,
      type: asset.type,
      department: asset.department || '',
      user: asset.user || '',
      value: String(asset.value || 0),
      purchase_date: asset.purchase_date || chinaToday(),
      config: asset.config || {},
    });
    setIsDialogOpen(true);
  };

  // 删除资产
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个资产吗？')) return;
    
    try {
      const response = await fetch(`/api/assets?id=${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        await fetchAssets();
      }
    } catch (error) {
      console.error('Failed to delete asset:', error);
    }
  };

  // 打开报废确认对话框
  const openScrapDialog = (id: number) => {
    setScrapAssetId(id);
    setScrapConfirmer('');
    setScrapDialogOpen(true);
  };
  
  // 报废资产
  const handleScrap = async () => {
    if (!scrapAssetId) return;
    if (!scrapConfirmer.trim()) {
      alert('请填写确认人名称');
      return;
    }
    
    try {
      const response = await fetch(`/api/assets/${scrapAssetId}/scrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmer: scrapConfirmer.trim() }),
      });
      const data = await response.json();
      if (data.success) {
        setScrapDialogOpen(false);
        setScrapAssetId(null);
        setScrapConfirmer('');
        await fetchAssets();
      } else {
        alert(data.error || '报废失败');
      }
    } catch (error) {
      console.error('Failed to scrap asset:', error);
      alert('报废失败，请稍后重试');
    }
  };

  const handleAddAsset = async () => {
    if (!newAsset.name || !newAsset.department || !newAsset.value) {
      return;
    }
    
    // 如果选择自定义类型，则使用自定义类型名称
    const assetType = newAsset.type === '自定义' && customAssetType ? customAssetType : newAsset.type;
    if (newAsset.type === '自定义' && !customAssetType) {
      return;
    }

    try {
      const method = editingAsset ? 'PUT' : 'POST';
      const body = editingAsset 
        ? {
            id: editingAsset.id,
            type: assetType,
            name: newAsset.name,
            department: newAsset.department,
            user: newAsset.user || null,
            value: parseFloat(newAsset.value),
            purchase_date: newAsset.purchase_date,
            status: editingAsset.status,
            config: newAsset.config,
          }
        : {
            type: assetType,
            name: newAsset.name,
            department: newAsset.department,
            user: newAsset.user || null,
            value: parseFloat(newAsset.value),
            purchase_date: newAsset.purchase_date,
            config: newAsset.config,
          };

      const response = await fetch('/api/assets', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (data.success) {
        await fetchAssets();
        handleCloseDialog();
      }
    } catch (error) {
      console.error('Failed to save asset:', error);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAsset(null);
    setCustomAssetType('');
    setNewAsset({
      name: '',
      type: '电脑',
      department: '',
      user: '',
      value: '',
      purchase_date: chinaToday(),
      config: {},
    });
  };

  // 筛选资产列表
  const filteredAssets = assetList.filter(asset => {
    const matchKeyword = asset.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                         asset.department?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                         asset.user?.toLowerCase().includes(searchKeyword.toLowerCase());
    const matchType = filterType === 'all' || asset.type === filterType;
    return matchKeyword && matchType;
  });

  // 统计各类资产数量
  const assetTypeFilterOptions = [
    ...assetTypes.filter(type => type.value !== '自定义'),
    ...Array.from(new Set(assetList.map(asset => asset.type).filter(Boolean)))
      .filter(type => !assetTypes.some(option => option.value === type))
      .map(type => ({ value: type, label: type })),
  ];

  const assetTypeCounts = assetTypeFilterOptions.map(type => ({
    ...type,
    count: assetList.filter(a => a.type === type.value).length,
  })).filter(type => type.count > 0 || filterType === type.value);

  const assetGroups = assetTypeFilterOptions
    .map(type => ({
      ...type,
      assets: filteredAssets.filter(asset => asset.type === type.value),
    }))
    .filter(group => group.assets.length > 0);

  const defaultAssetGroupValues = assetGroups.map(group => group.value);
  const isSpecificTypePage = selectedType !== 'all';
  const pageTitle = isSpecificTypePage ? `${selectedType}资产` : '资产管理';
  const displayedAssetTypeCounts = isSpecificTypePage
    ? assetTypeCounts.filter(type => type.value === selectedType)
    : assetTypeCounts;

  const renderAssetTable = (assets: Asset[]) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>资产名称</TableHead>
            <TableHead>资产类型</TableHead>
            <TableHead>所属部门</TableHead>
            <TableHead>使用人</TableHead>
            <TableHead>资产价值</TableHead>
            <TableHead>购买日期</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-center">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => (
            <TableRow key={asset.id}>
              <TableCell className="font-medium">{asset.name}</TableCell>
              <TableCell>{asset.type}</TableCell>
              <TableCell>{asset.department || '-'}</TableCell>
              <TableCell>{asset.user || '-'}</TableCell>
              <TableCell>¥{asset.value?.toLocaleString() || 0}</TableCell>
              <TableCell>{asset.purchase_date || '-'}</TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(asset.status)}>
                  {asset.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-blue-600 hover:text-blue-700"
                    onClick={() => handleShowQRCode(asset.id)}
                    title="查看二维码"
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-600 hover:text-slate-700"
                    onClick={() => handleEdit(asset)}
                    title="编辑"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {asset.status !== '报废' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-orange-600 hover:text-orange-700"
                      onClick={() => openScrapDialog(asset.id)}
                      title="报废"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700"
                    onClick={() => handleDelete(asset.id)}
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  // 渲染配置表单
  const renderConfigForm = () => {
    switch (newAsset.type) {
      case '电脑':
        return (
          <div className="space-y-4 border-t pt-4 mt-4">
            <h4 className="font-medium text-slate-700">💻 电脑配置</h4>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">CPU</Label>
              <Input
                value={newAsset.config.cpu || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, cpu: e.target.value } })}
                placeholder="如：Intel i7-13700K"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">内存</Label>
              <Input
                value={newAsset.config.memory || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, memory: e.target.value } })}
                placeholder="如：32GB DDR5"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">显卡</Label>
              <Input
                value={newAsset.config.gpu || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, gpu: e.target.value } })}
                placeholder="如：RTX 4070"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">存储</Label>
              <Input
                value={newAsset.config.storage || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, storage: e.target.value } })}
                placeholder="如：1TB NVMe SSD"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">操作系统</Label>
              <Input
                value={newAsset.config.system || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, system: e.target.value } })}
                placeholder="如：Windows 11 Pro"
                className="col-span-3"
              />
            </div>
          </div>
        );
      case '显示器':
        return (
          <div className="space-y-4 border-t pt-4 mt-4">
            <h4 className="font-medium text-slate-700">🖥️ 显示器参数</h4>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">尺寸/分辨率</Label>
              <Input
                value={newAsset.config.monitor || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, monitor: e.target.value } })}
                placeholder="如：27寸 2K 165Hz"
                className="col-span-3"
              />
            </div>
          </div>
        );
      case '手机':
        return (
          <div className="space-y-4 border-t pt-4 mt-4">
            <h4 className="font-medium text-slate-700">📱 手机配置</h4>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">存储容量</Label>
              <Input
                value={newAsset.config.memory || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, memory: e.target.value } })}
                placeholder="如：256GB"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">系统版本</Label>
              <Input
                value={newAsset.config.system || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, system: e.target.value } })}
                placeholder="如：iOS 17.2"
                className="col-span-3"
              />
            </div>
          </div>
        );
      case '路由器':
        return (
          <div className="space-y-4 border-t pt-4 mt-4">
            <h4 className="font-medium text-slate-700">🌐 路由器参数</h4>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">型号/规格</Label>
              <Input
                value={newAsset.config.system || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, system: e.target.value } })}
                placeholder="如：AX6000 WiFi6E"
                className="col-span-3"
              />
            </div>
          </div>
        );
      case '笔记本电脑':
        return (
          <div className="space-y-4 border-t pt-4 mt-4">
            <h4 className="font-medium text-slate-700">💻 笔记本电脑配置</h4>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">CPU</Label>
              <Input
                value={newAsset.config.cpu || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, cpu: e.target.value } })}
                placeholder="如：Intel i7-13700H"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">内存</Label>
              <Input
                value={newAsset.config.memory || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, memory: e.target.value } })}
                placeholder="如：16GB DDR5"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">硬盘</Label>
              <Input
                value={newAsset.config.storage || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, storage: e.target.value } })}
                placeholder="如：512GB SSD"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">屏幕尺寸</Label>
              <Input
                value={newAsset.config.monitor || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, monitor: e.target.value } })}
                placeholder="如：14寸 2K"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">操作系统</Label>
              <Input
                value={newAsset.config.system || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, system: e.target.value } })}
                placeholder="如：Windows 11 Pro"
                className="col-span-3"
              />
            </div>
          </div>
        );
      case '苹果平板电脑':
        return (
          <div className="space-y-4 border-t pt-4 mt-4">
            <h4 className="font-medium text-slate-700">🍎 苹果平板电脑配置</h4>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">型号</Label>
              <Input
                value={newAsset.config.system || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, system: e.target.value } })}
                placeholder="如：iPad Pro 12.9寸 M2"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">存储容量</Label>
              <Input
                value={newAsset.config.storage || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, storage: e.target.value } })}
                placeholder="如：256GB"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">序列号</Label>
              <Input
                value={newAsset.config.memory || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, memory: e.target.value } })}
                placeholder="设备序列号"
                className="col-span-3"
              />
            </div>
          </div>
        );
      case '安卓平板电脑':
        return (
          <div className="space-y-4 border-t pt-4 mt-4">
            <h4 className="font-medium text-slate-700">📱 安卓平板电脑配置</h4>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">型号</Label>
              <Input
                value={newAsset.config.system || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, system: e.target.value } })}
                placeholder="如：小米平板6 Pro"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">存储容量</Label>
              <Input
                value={newAsset.config.storage || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, storage: e.target.value } })}
                placeholder="如：128GB"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">屏幕尺寸</Label>
              <Input
                value={newAsset.config.monitor || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, monitor: e.target.value } })}
                placeholder="如：11寸 2.8K"
                className="col-span-3"
              />
            </div>
          </div>
        );
      case '安卓生产看板':
        return (
          <div className="space-y-4 border-t pt-4 mt-4">
            <h4 className="font-medium text-slate-700">📺 安卓生产看板配置</h4>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">型号</Label>
              <Input
                value={newAsset.config.system || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, system: e.target.value } })}
                placeholder="如：华为企业智慧屏"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">屏幕尺寸</Label>
              <Input
                value={newAsset.config.monitor || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, monitor: e.target.value } })}
                placeholder="如：55寸 4K"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">安装位置</Label>
              <Input
                value={newAsset.config.storage || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, storage: e.target.value } })}
                placeholder="如：车间A区"
                className="col-span-3"
              />
            </div>
          </div>
        );
      case '电视机':
        return (
          <div className="space-y-4 border-t pt-4 mt-4">
            <h4 className="font-medium text-slate-700">📺 电视机配置</h4>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">型号</Label>
              <Input
                value={newAsset.config.system || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, system: e.target.value } })}
                placeholder="如：小米电视大师 77寸"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">屏幕尺寸</Label>
              <Input
                value={newAsset.config.monitor || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, monitor: e.target.value } })}
                placeholder="如：77寸 OLED"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">分辨率</Label>
              <Input
                value={newAsset.config.storage || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, storage: e.target.value } })}
                placeholder="如：4K 120Hz"
                className="col-span-3"
              />
            </div>
          </div>
        );
      case '大疆设备':
        return (
          <div className="space-y-4 border-t pt-4 mt-4">
            <h4 className="font-medium text-slate-700">🚁 大疆设备配置</h4>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">设备型号</Label>
              <Input
                value={newAsset.config.system || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, system: e.target.value } })}
                placeholder="如：Mavic 3 Pro / RS3 Pro"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">序列号</Label>
              <Input
                value={newAsset.config.memory || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, memory: e.target.value } })}
                placeholder="设备序列号/SN码"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">配件</Label>
              <Input
                value={newAsset.config.storage || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, storage: e.target.value } })}
                placeholder="如：电池x3、充电器、收纳箱"
                className="col-span-3"
              />
            </div>
          </div>
        );
      case '扫码枪':
        return (
          <div className="space-y-4 border-t pt-4 mt-4">
            <h4 className="font-medium text-slate-700">🔫 扫码枪配置</h4>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">型号</Label>
              <Input
                value={newAsset.config.system || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, system: e.target.value } })}
                placeholder="如：霍尼韦尔 1900G"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">连接方式</Label>
              <Input
                value={newAsset.config.storage || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, storage: e.target.value } })}
                placeholder="如：USB有线 / 蓝牙无线"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">序列号</Label>
              <Input
                value={newAsset.config.memory || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, memory: e.target.value } })}
                placeholder="设备序列号"
                className="col-span-3"
              />
            </div>
          </div>
        );
      case '空调遥控器':
        return (
          <div className="space-y-4 border-t pt-4 mt-4">
            <h4 className="font-medium text-slate-700">❄️ 空调遥控器配置</h4>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">型号</Label>
              <Input
                value={newAsset.config.system || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, system: e.target.value } })}
                placeholder="如：格力原装遥控器"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">适配品牌</Label>
              <Input
                value={newAsset.config.storage || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, storage: e.target.value } })}
                placeholder="如：格力/美的/海尔通用"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">使用位置</Label>
              <Input
                value={newAsset.config.monitor || ''}
                onChange={(e) => setNewAsset({ ...newAsset, config: { ...newAsset.config, monitor: e.target.value } })}
                placeholder="如：办公室A区"
                className="col-span-3"
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">{pageTitle}</h1>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
          {/* 搜索框 */}
          <Input
            placeholder="搜索资产..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full sm:w-48"
          />
          {!isSpecificTypePage && (
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {assetTypeFilterOptions.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            className="h-9 whitespace-nowrap"
            onClick={handleDownloadAllQRCodes}
            disabled={downloadingQRCodes || assetList.length === 0}
          >
            {downloadingQRCodes ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            下载全部二维码
          </Button>
          <Dialog
            open={bulkDialogOpen}
            onOpenChange={(open) => {
              setBulkDialogOpen(open);
              if (!open) resetBulkAsset();
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="h-9 whitespace-nowrap">
                <Sparkles className="mr-2 h-4 w-4" />
                一键生成资产
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">一键生成资产</DialogTitle>
                <DialogDescription>
                  按名称前缀和编号批量生成资产记录。
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">资产类型</Label>
                  {bulkAsset.type === '自定义' ? (
                    <Input
                      value={bulkCustomAssetType}
                      onChange={(e) => setBulkCustomAssetType(e.target.value)}
                      placeholder="输入自定义类型"
                      className="col-span-3"
                    />
                  ) : (
                    <Select
                      value={bulkAsset.type}
                      onValueChange={(value) => {
                        setBulkAsset({ ...bulkAsset, type: value });
                        if (value === '自定义') setBulkCustomAssetType('');
                      }}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="选择资产类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {assetTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">名称前缀</Label>
                  <Input
                    value={bulkAsset.namePrefix}
                    onChange={(e) => setBulkAsset({ ...bulkAsset, namePrefix: e.target.value })}
                    placeholder="例如：电脑"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">生成数量</Label>
                  <Input
                    type="number"
                    min="1"
                    max="500"
                    value={bulkAsset.count}
                    onChange={(e) => setBulkAsset({ ...bulkAsset, count: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">起始编号</Label>
                  <Input
                    type="number"
                    min="1"
                    value={bulkAsset.startNumber}
                    onChange={(e) => setBulkAsset({ ...bulkAsset, startNumber: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">所属部门</Label>
                  <Input
                    value={bulkAsset.department}
                    onChange={(e) => setBulkAsset({ ...bulkAsset, department: e.target.value })}
                    placeholder="输入所属部门"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">使用人</Label>
                  <Input
                    value={bulkAsset.user}
                    onChange={(e) => setBulkAsset({ ...bulkAsset, user: e.target.value })}
                    placeholder="可选"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">资产价值</Label>
                  <Input
                    type="number"
                    min="0"
                    value={bulkAsset.value}
                    onChange={(e) => setBulkAsset({ ...bulkAsset, value: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">购买日期</Label>
                  <Input
                    type="date"
                    value={bulkAsset.purchase_date}
                    onChange={(e) => setBulkAsset({ ...bulkAsset, purchase_date: e.target.value })}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleBulkGenerateAssets} disabled={bulkGenerating}>
                  {bulkGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  生成
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {/* 新增按钮 */}
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setIsDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 h-9">
                + 新增资产
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">
                  {editingAsset ? '编辑资产' : '新增资产'}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">
                    资产类型 <span className="text-red-500">*</span>
                  </Label>
                  {newAsset.type === '自定义' ? (
                    <Input
                      id="customType"
                      value={customAssetType}
                      onChange={(e) => setCustomAssetType(e.target.value)}
                      placeholder="请输入自定义资产类型"
                      className="col-span-3"
                    />
                  ) : (
                    <Select
                      value={newAsset.type}
                      onValueChange={(value) => {
                        setNewAsset({ ...newAsset, type: value, config: {} });
                        if (value === '自定义') {
                          setCustomAssetType('');
                        }
                      }}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="选择资产类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {assetTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    资产名称 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={newAsset.name}
                    onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                    placeholder="请输入资产名称"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="department" className="text-right">
                    所属部门 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="department"
                    value={newAsset.department}
                    onChange={(e) => setNewAsset({ ...newAsset, department: e.target.value })}
                    placeholder="请输入所属部门"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="user" className="text-right">
                    使用人
                  </Label>
                  <Input
                    id="user"
                    value={newAsset.user}
                    onChange={(e) => setNewAsset({ ...newAsset, user: e.target.value })}
                    placeholder="请输入使用人（可选）"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="value" className="text-right">
                    资产价值 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="value"
                    type="number"
                    value={newAsset.value}
                    onChange={(e) => setNewAsset({ ...newAsset, value: e.target.value })}
                    placeholder="请输入资产价值"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="purchase_date" className="text-right">
                    购买日期
                  </Label>
                  <Input
                    id="purchase_date"
                    type="date"
                    value={newAsset.purchase_date}
                    onChange={(e) => setNewAsset({ ...newAsset, purchase_date: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                
                {/* 根据类型显示不同的配置表单 */}
                {renderConfigForm()}
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleCloseDialog}>
                  取消
                </Button>
                <Button onClick={handleAddAsset}>
                  {editingAsset ? '保存' : '确定'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {displayedAssetTypeCounts.map((type) => (
          <Card
            key={type.value}
            role="button"
            tabIndex={0}
            className={`transition-colors ${
              filterType === type.value ? 'border-blue-500 bg-blue-50' : 'hover:border-blue-300'
            }`}
            onClick={() => {
              if (!isSpecificTypePage) setFilterType(type.value);
            }}
            onKeyDown={(event) => {
              if (!isSpecificTypePage && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                setFilterType(type.value);
              }
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {type.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">{type.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Asset Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>资产列表 ({filteredAssets.length})</CardTitle>
            {filterType !== 'all' && !isSpecificTypePage && (
              <Button variant="outline" size="sm" onClick={() => setFilterType('all')}>
                查看全部分类
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredAssets.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              暂无资产数据
            </div>
          ) : filterType === 'all' ? (
            <Accordion type="multiple" defaultValue={defaultAssetGroupValues} className="space-y-3">
              {assetGroups.map((group) => (
                <AccordionItem
                  key={group.value}
                  value={group.value}
                  className="rounded-md border px-3"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex w-full items-center justify-between gap-3 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{group.label}</span>
                        <Badge variant="secondary">{group.assets.length}</Badge>
                      </div>
                      <span className="text-xs text-slate-500">按类型分类</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {renderAssetTable(group.assets)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            renderAssetTable(filteredAssets)
          )}
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={isQRDialogOpen} onOpenChange={setIsQRDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">资产二维码</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {qrCodeData && (
              <>
                <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
                  <Image
                    src={qrCodeData.qrCode}
                    alt="资产二维码"
                    width={250}
                    height={250}
                  />
                </div>
                <p className="text-sm text-slate-500 text-center mb-4">
                  扫描二维码查看资产详情
                </p>
                <p className="text-xs text-slate-400 text-center break-all">
                  {qrCodeData.url}
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Scrap Confirm Dialog */}
      <Dialog open={scrapDialogOpen} onOpenChange={setScrapDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">资产报废确认</DialogTitle>
            <DialogDescription>
              请填写报废确认人姓名，确认后将无法恢复。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="confirmer">确认人姓名 *</Label>
              <Input
                id="confirmer"
                placeholder="请输入确认人姓名"
                value={scrapConfirmer}
                onChange={(e) => setScrapConfirmer(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScrapDialogOpen(false)}>
              取消
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleScrap}
              disabled={!scrapConfirmer.trim()}
            >
              确认报废
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
