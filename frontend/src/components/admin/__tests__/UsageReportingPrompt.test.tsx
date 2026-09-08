import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import UsageReportingPrompt from '../UsageReportingPrompt';
import { productUsageService as service } from '../../../services/productUsage.service';

const permission = vi.hoisted(() => ({ allowed: true }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('../../../contexts/PermissionsContext', () => ({
  usePermissions: () => ({ hasPermission: () => permission.allowed }),
}));
vi.mock('../../../services/productUsage.service', () => ({ productUsageService: {
  status: vi.fn(), promptSeen: vi.fn(), enable: vi.fn(),
} }));
const status = { status: 'disabled', prompt_shown: false, collector_url: 'https://custom-collector.example.test' };
beforeEach(() => {
  vi.clearAllMocks();
  permission.allowed = true;
  vi.mocked(service.status).mockResolvedValue({ ...status } as never);
  vi.mocked(service.promptSeen).mockResolvedValue({ ...status, prompt_shown: true } as never);
  vi.mocked(service.enable).mockResolvedValue({ ...status, status: 'active', prompt_shown: true } as never);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = <QueryClientProvider client={client}><UsageReportingPrompt /></QueryClientProvider>;
  return { ...render(tree), client, tree };
}

it('focuses an accessible native dialog, acknowledges Escape and restores focus', async () => {
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  try {
    mount();
    const dialog = await screen.findByRole('dialog', { name: 'productUsagePrompt.title' });
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog).toHaveFocus();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(service.promptSeen).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(service.enable).not.toHaveBeenCalled();
  } finally { opener.remove(); }
});

it('declining survives remount and does not opt in', async () => {
  const { rerender, tree, client } = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'setup.usageReporting.skip' }));
  await waitFor(() => expect(client.getQueryData(['productUsage'])).toEqual({ ...status, prompt_shown: true }));
  vi.mocked(service.status).mockResolvedValue({ ...status, prompt_shown: true } as never);
  rerender(<></>);
  rerender(tree);
  await waitFor(() => expect(client.isFetching()).toBe(0));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(service.enable).not.toHaveBeenCalled();
});

it.each(['active', 'activation_pending', 'deletion_pending', 'identity_conflict'])('does not invite a %s installation', async (state) => {
  vi.mocked(service.status).mockResolvedValue({ ...status, status: state } as never);
  const { client } = mount();
  await waitFor(() => expect(client.getQueryData(['productUsage'])).toBeDefined());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('does not query or invite an admin without settings.edit', () => {
  permission.allowed = false;
  mount();
  expect(service.status).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('requires the complete disclosure and a fresh checkbox; cancelling is not consent', async () => {
  mount();
  const review = await screen.findByRole('button', { name: 'productUsage.review' });
  fireEvent.click(review);
  let consent = within(screen.getByRole('dialog', { name: 'productUsage.consentTitle' }));
  for (const key of ['fields', 'visibility', 'deletion', 'versionDisclosure', 'catalogTitle']) {
    expect(consent.getByText(`productUsage.${key}`)).toBeInTheDocument();
  }
  expect(consent.getByRole('link', { name: 'productUsage.linkCollector' })).toHaveAttribute('href', status.collector_url);
  expect(consent.getByRole('button', { name: 'productUsage.enable' })).toBeDisabled();
  fireEvent.click(consent.getByRole('checkbox'));
  fireEvent.click(consent.getByRole('button', { name: 'productUsage.cancel' }));
  expect(service.enable).not.toHaveBeenCalled();
  expect(service.promptSeen).not.toHaveBeenCalled();
  fireEvent.click(review);
  consent = within(screen.getByRole('dialog', { name: 'productUsage.consentTitle' }));
  expect(consent.getByRole('checkbox')).not.toBeChecked();
  fireEvent.click(consent.getByRole('checkbox'));
  fireEvent.click(consent.getByRole('button', { name: 'productUsage.enable' }));
  await waitFor(() => expect(service.enable).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('an unavailable collector cannot enable reporting and does not prevent dismissal', async () => {
  vi.mocked(service.status).mockResolvedValue({ ...status, collector_url: null, collector_error: 'INVALID_COLLECTOR_URL' } as never);
  mount();
  expect(await screen.findByRole('button', { name: 'productUsage.review' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'setup.usageReporting.skip' }));
  await waitFor(() => expect(service.promptSeen).toHaveBeenCalled());
  expect(service.enable).not.toHaveBeenCalled();
});

it('keeps consent open after failure and prevents Escape during an in-flight opt-in', async () => {
  let rejectEnable!: (error: Error) => void;
  vi.mocked(service.enable).mockReturnValue(new Promise((_resolve, reject) => { rejectEnable = reject; }));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'productUsage.review' }));
  const dialog = screen.getByRole('dialog', { name: 'productUsage.consentTitle' });
  const consent = within(dialog);
  fireEvent.click(consent.getByRole('checkbox'));
  fireEvent.click(consent.getByRole('button', { name: 'productUsage.enable' }));
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(dialog).toBeInTheDocument();
  expect(consent.getByRole('button', { name: 'productUsage.cancel' })).toBeDisabled();
  rejectEnable(new Error('Collector unavailable'));
  await waitFor(() => expect(consent.getByRole('button', { name: 'productUsage.cancel' })).toBeEnabled());
  expect(service.promptSeen).not.toHaveBeenCalled();
});
