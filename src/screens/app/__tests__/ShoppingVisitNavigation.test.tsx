import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import type { ShoppingSnap } from '../../../types/shoppingSnap';

jest.mock('../../../components/shopping/ShoppingPhotoOrganizer', () => ({ ShoppingPhotoOrganizer: 'ShoppingPhotoOrganizer' }));
jest.mock('../../../components/shopping/ShoppingStoreAssignmentSheet', () => ({ ShoppingStoreAssignmentSheet: 'ShoppingStoreAssignmentSheet' }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
jest.mock('../../../hooks/useAssignShoppingStore', () => ({ useAssignShoppingStore: () => jest.fn() }));
jest.mock('../../../lib/shoppingPreviews', () => ({ deleteShoppingPreview: jest.fn() }));
jest.mock('../../../lib/deleteShoppingSnaps', () => ({ deleteShoppingSnaps: jest.fn() }));
const mockSave = jest.fn().mockResolvedValue(undefined), mockEndVisit = jest.fn();
jest.mock('../../../hooks/useShoppingItemActions', () => ({ useShoppingItemActions: () => ({ saveOrganization: mockSave, isSavingOrganization: false }) }));
const mockSnaps = [{ id: 'photo', captureGroupId: 'group', shoppingSessionId: 'visit', imageUri: 'file://photo.jpg', capturedAt: '2026-10-05', syncStatus: 'synced', captureRole: 'garment', catalogStatus: 'considering', rawOcrText: '', extractedPrice: 50, storeName: 'COS' }] as ShoppingSnap[];
jest.mock('../../../hooks/useShoppingSnaps', () => ({ useShoppingSnaps: () => ({ data: mockSnaps, isLoading: false }) }));
const mockState = { pendingUploads: [], visitPreviews: [], currentSession: null as { id: string } | null, pendingVisitMetadata: [], endVisit: mockEndVisit };
jest.mock('../../../stores/useShoppingSessionStore', () => ({ useShoppingSessionStore: Object.assign((selector: any) => selector(mockState), { getState: () => mockState }) }));
import { ShoppingVisitReviewScreen } from '../ShoppingVisitReviewScreen';
const navigation = { canGoBack: () => true, goBack: jest.fn(), popTo: jest.fn() };
let renderer: TestRenderer.ReactTestRenderer;
afterEach(() => { act(() => renderer?.unmount()); mockState.currentSession = null; jest.clearAllMocks(); });
function render() { act(() => { renderer = TestRenderer.create(<ShoppingVisitReviewScreen navigation={navigation as any} route={{ params: { sessionId: 'visit' } } as any} />); }); }

it('finishes a camera visit in embedded Shortlist and removes the completed camera from history', async () => {
  mockState.currentSession = { id: 'visit' };
  render();
  await act(async () => { await renderer.root.findByType('ShoppingPhotoOrganizer' as any).props.onSave([]); });
  expect(mockEndVisit).toHaveBeenCalledTimes(1);
  expect(navigation.popTo).toHaveBeenCalledWith('ShopMain', { view: 'shortlist' });
  expect(navigation.goBack).not.toHaveBeenCalled();
});

it('returns an existing-visit organizer to its original browser without resetting filters', async () => {
  render();
  await act(async () => { await renderer.root.findByType('ShoppingPhotoOrganizer' as any).props.onSave([]); });
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
  expect(navigation.popTo).not.toHaveBeenCalled();
  expect(mockEndVisit).not.toHaveBeenCalled();
});
