import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Archive,
  AlertTriangle,
  MoreVertical,
  ExternalLink,
  Edit,
  Download,
  Trash2,
  Calendar,
  Image,
  Activity
} from 'lucide-react';
import { parseISO, differenceInDays } from 'date-fns';
import { toast } from 'react-toastify';
import { useLocalizedDate } from '../../hooks/useLocalizedDate';

import { Button, Input, Card, SkeletonTable, ErrorBoundary } from '../../components/common';
import { BulkArchiveModal } from '../../components/admin';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsService } from '../../services/events.service';
import { isGalleryPublic } from '../../utils/accessControl';
import type { Event } from '../../types';
import { useTranslation } from 'react-i18next';

const resolveShareLink = (link: string): string => {
  if (!link) return '#';
  if (link.startsWith('http')) return link;
  if (link.startsWith('/')) return link;
  return `/gallery/${link}`;
};

export const EventsListPage: React.FC = () => {
  const { t } = useTranslation();
  const { format } = useLocalizedDate();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<number[]>([]);
  // const [showFilters, setShowFilters] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [showBulkArchiveModal, setShowBulkArchiveModal] = useState(false);

  // Get filter from URL
  const statusFilter = searchParams.get('filter') as 'active' | 'archived' | null;
  const isExpiringFilter = searchParams.get('filter') === 'expiring';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setActiveDropdown(null);
        setDropdownPosition(null);
      }
    };

    if (activeDropdown !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeDropdown]);

  // Update dropdown position on scroll/resize
  useEffect(() => {
    const handleScrollOrResize = () => {
      if (activeDropdown !== null) {
        setActiveDropdown(null);
        setDropdownPosition(null);
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeDropdown]);

  // Fetch events
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-events', statusFilter],
    queryFn: () => eventsService.getEvents(1, 100, (statusFilter === 'archived' || statusFilter === 'active') ? statusFilter : undefined),
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: eventsService.archiveEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      toast.success(t('toast.eventArchived'));
    },
    onError: () => {
      toast.error(t('toast.saveError'));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: eventsService.deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      toast.success(t('toast.deleteSuccess'));
    },
    onError: () => {
      toast.error(t('toast.deleteError'));
    },
  });

  // Bulk archive mutation
  const bulkArchiveMutation = useMutation({
    mutationFn: eventsService.bulkArchiveEvents,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      setSelectedEvents([]);
      setShowBulkArchiveModal(false);
      
      if (data.results.failed.length === 0) {
        toast.success(t('events.bulkArchiveSuccess', { count: data.results.successful.length }));
      } else {
        toast.warning(t('events.bulkArchivePartial', { success: data.results.successful.length, failed: data.results.failed.length }));
      }
    },
    onError: () => {
      toast.error(t('toast.saveError'));
    },
  });

  // Filter and search events
  const filteredEvents = useMemo(() => {
    if (!data?.events) return [];
    
    let events = [...data.events];
    
    // Apply status filter
    if (statusFilter === 'active') {
      events = events.filter(e => e.is_active && !e.is_archived);
    } else if (isExpiringFilter) {
      events = events.filter(e => {
        if (!e.is_active || e.is_archived) return false;
        const days = e.expires_at ? differenceInDays(parseISO(e.expires_at), new Date()) : 0;
        return days <= 7 && days > 0;
      });
    } else if (statusFilter === 'archived') {
      events = events.filter(e => e.is_archived);
    }
    
    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      events = events.filter(e => 
        e.event_name.toLowerCase().includes(term) ||
        e.event_type.toLowerCase().includes(term) ||
        (e.customer_email || '').toLowerCase().includes(term)
      );
    }
    
    // Sort by creation date (newest first)
    events.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
    
    return events;
  }, [data?.events, statusFilter, searchTerm]);

  const handleSelectAll = () => {
    if (selectedEvents.length === filteredEvents.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(filteredEvents.map(e => e.id));
    }
  };

  const handleSelectEvent = (id: number) => {
    setSelectedEvents(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const getEventStatus = (event: Event) => {
    if (event.is_archived) return { label: t('events.archived'), color: 'text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700' };
    if (!event.is_active) return { label: t('events.inactive'), color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40' };

    const days = event.expires_at ? differenceInDays(parseISO(event.expires_at), new Date()) : 0;
    if (days <= 0) return { label: t('events.expired'), color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40' };
    if (days <= 7) return { label: t('events.daysLeft', { count: days }), color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40' };

    return { label: t('events.active'), color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40' };
  };

  if (isLoading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('events.title')}</h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">{t('events.subtitle')}</p>
          </div>
        </div>
        <SkeletonTable rows={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{t('events.failedToLoadEvents')}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          {t('events.tryAgain')}
        </Button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div>
        {/* Page Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('events.title')}</h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">{t('events.subtitle')}</p>
          </div>
          <Button
            variant="primary"
            leftIcon={<Plus className="w-5 h-5" />}
            onClick={() => navigate('/admin/events/new')}
          >
            {t('events.createEvent')}
          </Button>
        </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card padding="sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('events.stats.totalEvents')}</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{data?.events.length || 0}</p>
            </div>
            <Calendar className="w-8 h-8 text-primary-600" />
          </div>
        </Card>
        
        <Card padding="sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('events.stats.activeEvents')}</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {data?.events.filter(e => e.is_active && !e.is_archived).length || 0}
              </p>
            </div>
            <Activity className="w-8 h-8 text-green-600" />
          </div>
        </Card>
        
        <Card padding="sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('events.stats.totalPhotos')}</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {data?.events.reduce((sum, e) => sum + (e.photo_count || 0), 0) || 0}
              </p>
            </div>
            <Image className="w-8 h-8 text-blue-600" />
          </div>
        </Card>
        
        <Card padding="sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('events.stats.expiringEvents')}</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {data?.events.filter(e => {
                  if (!e.is_active || e.is_archived) return false;
                  const days = e.expires_at ? differenceInDays(parseISO(e.expires_at), new Date()) : 0;
                  return days <= 7 && days > 0;
                }).length || 0}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card padding="sm" className="mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <Input
              type="text"
              placeholder={t('events.searchEventsPlaceholder')}
              leftIcon={<Search className="w-5 h-5 text-neutral-400" />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2">
            <Button
              variant={!statusFilter ? 'primary' : 'outline'}
              size="md"
              onClick={() => {
                searchParams.delete('filter');
                setSearchParams(searchParams);
              }}
            >
              {t('events.all')} ({data?.events.length || 0})
            </Button>
            <Button
              variant={statusFilter === 'active' ? 'primary' : 'outline'}
              size="md"
              onClick={() => setSearchParams({ filter: 'active' })}
            >
              {t('events.active')}
            </Button>
            <Button
              variant={isExpiringFilter ? 'primary' : 'outline'}
              size="md"
              onClick={() => setSearchParams({ filter: 'expiring' })}
              leftIcon={<AlertTriangle className="w-4 h-4" />}
            >
              {t('events.expiring')}
            </Button>
            <Button
              variant={statusFilter === 'archived' ? 'primary' : 'outline'}
              size="md"
              onClick={() => setSearchParams({ filter: 'archived' })}
              leftIcon={<Archive className="w-4 h-4" />}
            >
              {t('events.archived')}
            </Button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedEvents.length > 0 && (
          <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-900/30 rounded-lg flex items-center justify-between">
            <span className="text-sm text-primary-900 dark:text-primary-100">
              {t('events.eventsSelected', { count: selectedEvents.length })}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedEvents([])}>
                {t('events.clear')}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowBulkArchiveModal(true)}
              >
                {t('events.archiveSelected')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Events Table */}
      <Card className="overflow-visible">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedEvents.length === filteredEvents.length && filteredEvents.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-primary-600 border-neutral-300 dark:border-neutral-600 rounded focus:ring-primary-500 dark:bg-neutral-700"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  {t('events.event')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  {t('events.type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  {t('events.date')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  {t('events.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  {t('events.expires')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  {t('events.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-700">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    {t('events.noEventsFound')}
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => {
                  const status = getEventStatus(event);

                  return (
                    <tr
                      key={event.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50 cursor-pointer"
                      onClick={() => navigate(`/admin/events/${event.id}`)}
                    >
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(event.id)}
                          onChange={() => handleSelectEvent(event.id)}
                          className="w-4 h-4 text-primary-600 border-neutral-300 dark:border-neutral-600 rounded focus:ring-primary-500 dark:bg-neutral-700"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{event.event_name}</p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">{event.customer_email}</p>
                          <div className="mt-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                isGalleryPublic(event.require_password)
                                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                              }`}
                            >
                              {isGalleryPublic(event.require_password) ? t('events.publicAccess', 'Public access') : t('events.passwordProtected', 'Password protected')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">
                        {event.event_type}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">
                        {event.event_date ? format(parseISO(event.event_date), 'MMM d, yyyy') : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">
                        {event.expires_at ? format(parseISO(event.expires_at), 'MMM d, yyyy') : 'N/A'}
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {/* Inline action buttons - hidden on mobile */}
                          <div className="hidden md:flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/admin/events/${event.id}`)}
                              title={t('events.viewDetails')}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {event.share_link && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(resolveShareLink(event.share_link), '_blank')}
                                title={t('events.viewGallery')}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            )}
                          </div>

                          {/* Context menu for additional actions */}
                          <div className="relative inline-block text-left dropdown-container">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeDropdown === event.id) {
                                  setActiveDropdown(null);
                                  setDropdownPosition(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setActiveDropdown(event.id);
                                  setDropdownPosition({
                                    top: rect.bottom + window.scrollY,
                                    left: rect.right - 224 + window.scrollX // 224px = 14rem (w-56)
                                  });
                                }
                              }}
                              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1"
                            >
                              <MoreVertical className="w-5 h-5" />
                            </button>

                            {activeDropdown === event.id && dropdownPosition && (
                              <div
                                className="fixed z-50 w-56 rounded-md shadow-lg bg-white dark:bg-neutral-800 ring-1 ring-black ring-opacity-5 dark:ring-neutral-700"
                                style={{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px` }}
                              >
                                <div className="py-1">
                                  {/* Show Edit/View on mobile only (already visible inline on desktop) */}
                                  <button
                                    onClick={() => {
                                      navigate(`/admin/events/${event.id}`);
                                      setActiveDropdown(null);
                                      setDropdownPosition(null);
                                    }}
                                    className="md:hidden w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                                  >
                                    <Edit className="w-4 h-4" />
                                    {t('events.viewDetails')}
                                  </button>
                                  {event.share_link ? (
                                    <a
                                      href={resolveShareLink(event.share_link)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="md:hidden w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                                      onClick={() => {
                                        setActiveDropdown(null);
                                        setDropdownPosition(null);
                                      }}
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                      {t('events.viewGallery')}
                                    </a>
                                  ) : null}
                                  {!event.is_archived ? (
                                    <button
                                      onClick={() => {
                                        archiveMutation.mutate(event.id);
                                        setActiveDropdown(null);
                                        setDropdownPosition(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                                    >
                                      <Archive className="w-4 h-4" />
                                      {t('events.archiveEventAction')}
                                    </button>
                                  ) : null}
                                  {event.is_archived ? (
                                    <button
                                      onClick={() => {
                                        toast.info(t('events.downloadArchiveSoon'));
                                        setActiveDropdown(null);
                                        setDropdownPosition(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                                    >
                                      <Download className="w-4 h-4" />
                                      {t('events.downloadArchiveAction')}
                                    </button>
                                  ) : null}
                                  <button
                                    onClick={() => {
                                      if (confirm(t('events.deleteEventConfirm'))) {
                                        deleteMutation.mutate(event.id);
                                        setActiveDropdown(null);
                                        setDropdownPosition(null);
                                      }
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    {t('events.deleteEvent')}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      {/* Bulk Archive Modal */}
      <BulkArchiveModal
        isOpen={showBulkArchiveModal}
        onClose={() => setShowBulkArchiveModal(false)}
        onConfirm={() => bulkArchiveMutation.mutate(selectedEvents)}
        selectedEvents={filteredEvents.filter(e => selectedEvents.includes(e.id))}
        isLoading={bulkArchiveMutation.isPending}
      />
      </div>
    </ErrorBoundary>
  );
};

EventsListPage.displayName = 'EventsListPage';
