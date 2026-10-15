import { StylistChecklist } from './StylistChecklist';
import { StylistEditorialFrame } from './StylistEditorialFrame';
import { StylistInsight, StylistTagSuggestions } from './StylistEditorialEntities';
import { Fragment, useContext, useRef, useState } from 'react';
import { StylistCardStateContext, useStylistCardState, type StylistCardState } from './StylistCardState';
import { Image, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Reanimated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { track } from '../../lib/analytics';
import { useCreateOutfit } from '../../hooks/useOutfits';
import { addOutfitToWishlist } from '../../hooks/useWishlist';
import { ShopOutfitCard } from '../outfits/ShopOutfitCard';
import type { BoardEntryRef } from '../../hooks/useBoards';
import { StylistRichText } from './StylistRichText';
import { StylistRanking } from './response/StylistRanking';
import { StylistSuggestionTiles } from './response/StylistSuggestionTiles';
import { GapCard } from './GapCard';
import { CritiqueCard } from './CritiqueCard';
import { StylingMovesStrip } from './StylingMovesStrip';
import { TripPlanCard } from './TripPlanCard';
import { WardrobeAuditCard } from './WardrobeAuditCard';
import { StylistLookResponseCard } from './StylistLookResponseCard';
import { colors, spacing } from '../../theme';
import { GarmentImage } from '../wardrobe/garment-image';
import { additionalReferenceIds, mergeWardrobeEvidence, groupResponseBlocks, messageForResponseBlock } from '../../features/stylist/responseBlocks';
import type { StylistResponseBlock, StylistEntryContext, StylistEventPlanData, StylistMissingEssential } from '../../features/stylist/types';
import type { Item } from '../../types/item';
import { ItemDetailSheet } from './ChatItemDetailSheet';
import { ADVICE_THUMB_HEIGHT, ADVICE_THUMB_WIDTH, ChatMessage, EventContext, isProseMode } from './ChatModel';
import { OutfitSuggestionCard, pieceTip } from './ChatOutfitCard';
import { LookCarousel } from './ChatProgress';
import { styles } from './ChatStyles';
import { isMessageFresh } from './freshMessages';
import { sortByWearOrder } from '../../lib/outfitOrder';

// ── MessageBubble ─────────────────────────────────────────────────────────────

type BubbleProps = {
  message: ChatMessage;
  allItems: Item[];
  isPlaying: boolean;
  createOutfit: ReturnType<typeof useCreateOutfit>;
  eventContext?: EventContext;
  entryContext?: StylistEntryContext;
  onAddToEvent?: (itemIds: number[], eventPlan?: StylistEventPlanData | null) => Promise<unknown>;
  onToggleAudio?: () => void;
  onNavigateToShop?: (gap?: StylistMissingEssential) => void;
  onClarificationSelect?: (value: string) => void;
  onNavigateToCloset?: (outfitId: number) => void;
  onStyleAuditItem?: (itemId: number) => void;
  onSaveToBoard?: (ref: BoardEntryRef) => void;
  onViewSaved?: (id: string) => void;
};

export function MessageBubble({ message, allItems, isPlaying, createOutfit, eventContext, entryContext, onAddToEvent, onToggleAudio, onNavigateToShop, onClarificationSelect, onNavigateToCloset, onStyleAuditItem, onSaveToBoard, onViewSaved }: BubbleProps) {
  const isUser = message.role === 'user';
  // Frozen at mount: entrance animations only ever run on mount anyway.
  const [fresh] = useState(() => isMessageFresh(message.id));
  // Owned pieces for the horizontal strip, in wear order (outer layer, top, bottom, shoes…).
  const wardrobeStrip = sortByWearOrder(
    [...new Set(message.role === 'assistant' ? message.suggestedItemIds ?? [] : [])]
      .map((id) => allItems.find((i) => i.id === id))
      .filter((i): i is Item => !!i),
    (item) => item.category,
  );
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  // Bridges ShopOutfitCard's onSave (which mints the entry) to its onSaved
  // (which offers to board it) without widening the card's public contract.
  const [savedWishlistId, setSavedWishlistId] = useStylistCardState<string | null>('wishlist-id', null);

  const { width: responseWidth } = useWindowDimensions();
  const parentCardState = useContext(StylistCardStateContext);
  const fallbackBlockState = useRef<StylistCardState>({});
  if (!isUser && (message.responseVersion === 2 || message.responseVersion === 3) && message.blocks?.length) {
    const states = parentCardState ?? fallbackBlockState.current;
    return (
      <View style={styles.editorialResponse}>
        {groupResponseBlocks(message.blocks).map(group => {
          const renderBlock = (block: StylistResponseBlock, offset: number) => {
            const index = group.start + offset;
          if (!block) return null;
          const key = block.blockId ?? `block:${index}`;
          const displayBlock = block.type === 'text' ? { ...block, ownedItemIds: additionalReferenceIds(block, message.blocks ?? []) } : block;
          if (displayBlock.type === 'text' && !displayBlock.ownedItemIds?.length) return <StylistRichText key={key} text={block.text} />;
          const state = (states[key] ??= {}) as StylistCardState;
          return (
            <StylistCardStateContext.Provider key={key} value={state}>
              <StylistEditorialFrame unit={block.editorial} onRefine={message.isStreaming ? undefined : onClarificationSelect}>
              <MessageBubble
                message={messageForResponseBlock(message, displayBlock, index)}
                allItems={mergeWardrobeEvidence(allItems, block.wardrobeItems)} isPlaying={isPlaying} createOutfit={createOutfit}
                eventContext={eventContext} entryContext={entryContext} onAddToEvent={onAddToEvent}
                onNavigateToShop={onNavigateToShop} onClarificationSelect={onClarificationSelect}
                onNavigateToCloset={onNavigateToCloset} onStyleAuditItem={onStyleAuditItem}
                onSaveToBoard={onSaveToBoard} onViewSaved={onViewSaved}
              />
              </StylistEditorialFrame>
            </StylistCardStateContext.Provider>
          );
          };
          if (group.carousel && group.blocks.length > 1) return (
            <LookCarousel key={`looks:${group.start}`} width={responseWidth} count={group.blocks.length}>
              {group.blocks.map((block, offset) => <View key={block.blockId ?? offset} style={{ width: responseWidth - 64, marginRight: 16 }}>{renderBlock(block, offset)}</View>)}
            </LookCarousel>
          );
          return <Fragment key={`group:${group.start}`}>{group.blocks.map(renderBlock)}</Fragment>;
        })}
        {onToggleAudio && !message.isStreaming ? (
          <TouchableOpacity style={styles.quietAudioBtn} onPress={onToggleAudio} accessibilityLabel="Read stylist response aloud">
            <Ionicons name={isPlaying ? 'pause-circle-outline' : 'volume-medium-outline'} size={18} color={colors.mutedForeground} />
            <Text style={styles.quietActionText}>{isPlaying ? 'Pause' : 'Listen'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (!isUser && message.checklist) return <StylistChecklist checklist={message.checklist} />;
  if (!isUser && message.ranking) return <StylistRanking ranking={message.ranking} allItems={allItems} />;
  if (!isUser && message.suggestions) return <StylistSuggestionTiles suggestions={message.suggestions} />;

  if (!isUser && message.insight) return <StylistInsight insight={message.insight} />;
  if (!isUser && message.tagSuggestions) return <StylistTagSuggestions suggestion={message.tagSuggestions} />;

  if (!isUser && message.wardrobeAudit) {
    return (
      <EditorialEntrance fresh={fresh}>
        <View style={styles.editorialResponse}>
          <WardrobeAuditCard
            audit={message.wardrobeAudit}
            items={allItems}
            onStyleItem={onStyleAuditItem ?? (() => {})}
            onNavigateToShop={onNavigateToShop}
          />
        </View>
      </EditorialEntrance>
    );
  }

  // Trip plan — multi-outfit carousel + packing list (also renders progressively
  // while streaming, so check before the streaming-text fallback below).
  if (!isUser && message.tripPlan) {
    return (
      <EditorialEntrance fresh={fresh}>
        <View style={styles.editorialResponse}>
          <TripPlanCard
            plan={message.tripPlan}
            allItems={allItems}
            createOutfit={createOutfit}
            eventContext={eventContext}
            onAddToEvent={onAddToEvent}
            onNavigateToCloset={onNavigateToCloset}
          />
        </View>
      </EditorialEntrance>
    );
  }

  if (!isUser && message.readinessStatus && message.readinessStatus !== 'ready') {
    return (
      <EditorialEntrance fresh={fresh}>
        <View style={styles.editorialResponse}>
          <StylistLookResponseCard
            status={message.readinessStatus}
            messageText={message.text}
            lookName={message.lookName}
            itemIds={message.suggestedItemIds ?? []}
            foundationItemIds={message.foundationItemIds}
            rationale={message.rationale}
            completion={message.completion}
            reveal={fresh}
            missingEssentials={message.missingEssentials}
            clarification={message.clarification}
            allItems={allItems}
            createOutfit={createOutfit}
            eventContext={eventContext}
            eventPlan={message.eventPlan}
            onAddToEvent={onAddToEvent}
            onNavigateToCloset={onNavigateToCloset}
            onNavigateToShop={onNavigateToShop}
            onClarificationSelect={onClarificationSelect}
            onToggleAudio={onToggleAudio}
            isPlaying={isPlaying}
          />
        </View>
      </EditorialEntrance>
    );
  }

  // Advice / wardrobe audit — rich text (allows bullets) plus any referenced
  // wardrobe thumbnails and gap chips. Never an editable outfit card.
  if (!isUser && isProseMode(message.mode)) {
    return (
      <EditorialEntrance fresh={fresh}>
        <View style={styles.stylistNote}>
          {(message.responseVersion !== 2 && message.responseVersion !== 3) ? <View style={styles.sectionEyebrow}>
            <Text style={styles.sectionEyebrowText}>{message.boardAction === 'theme' ? 'Board direction' : message.boardAction === 'complete' ? 'Board edit' : message.mode === 'knowledge' ? 'Good to know' : 'My take'}</Text>
          </View> : null}
          <StylistRichText
            text={message.text}
            segments={message.isStreaming ? undefined : message.textSegments}
            streaming={message.isStreaming}
            onMentionPress={itemId => { const item = allItems.find(candidate => candidate.id === itemId); if (item) setDetailItem(item); }}
          />
          {message.critique ? (
            <CritiqueCard critique={message.critique} allItems={allItems} onItemPress={setDetailItem} />
          ) : null}
          {!!message.suggestedItemIds?.length && (
            <View style={styles.responseSection}>
              <Text style={styles.responseSectionTitle}>{entryContext?.kind === 'shopping_brief_edit' ? 'Pairs from your wardrobe' : message.critique ? 'The pieces' : 'From your wardrobe'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adviceThumbs}>
                {wardrobeStrip
                  .map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.adviceThumb}
                      onPress={() => setDetailItem(item)}
                      activeOpacity={0.8}
                      accessibilityLabel={`View ${item.name} details`}
                    >
                      <GarmentImage item={item} width={ADVICE_THUMB_WIDTH} height={ADVICE_THUMB_HEIGHT} placeholderIconSize={18} />
                      <Text style={styles.adviceItemName} numberOfLines={2}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
              {/* Thumbnails are too narrow for a tip, so tips list beneath the rail. */}
              {wardrobeStrip
                .filter((item) => !!pieceTip(message.pieceNotes, item.id))
                .map((item) => (
                  <Text key={item.id} style={styles.pieceTipRow}>
                    <Text style={styles.pieceTipName}>{item.name}</Text>
                    {'  '}
                    {pieceTip(message.pieceNotes, item.id)}
                  </Text>
                ))}
            </View>
          )}
          <StylingMovesStrip moves={message.stylingMoves} />
          {!!message.missingEssentials?.length && (
            <View style={styles.responseSection}>
              <Text style={styles.responseSectionTitle}>Closet gaps</Text>
              {[...message.missingEssentials]
                .sort((a, b) => a.priority - b.priority)
                .map((item, i) => <GapCard key={i} item={item} onPress={onNavigateToShop ? () => onNavigateToShop(item) : undefined} />)}
            </View>
          )}
          <ItemDetailSheet item={detailItem} onClose={() => setDetailItem(null)} />
          {onToggleAudio && (
            <TouchableOpacity style={styles.quietAudioBtn} onPress={onToggleAudio} accessibilityLabel="Read stylist note aloud">
              <Ionicons
                name={isPlaying ? 'pause-circle-outline' : 'volume-medium-outline'}
                size={18}
                color={colors.mutedForeground}
              />
              <Text style={styles.quietActionText}>{isPlaying ? 'Pause' : 'Listen'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </EditorialEntrance>
    );
  }

  if (!isUser && message.suggestedItemIds?.length) {
    return (
      <EditorialEntrance fresh={fresh}>
        <View style={styles.editorialResponse}>
          <OutfitSuggestionCard
            reveal={fresh}
            messageText={message.text}
            lookName={message.lookName}
            itemIds={message.suggestedItemIds}
            allItems={allItems}
            createOutfit={createOutfit}
            eventContext={eventContext}
            onAddToEvent={onAddToEvent}
            eventPlan={message.eventPlan}
            recId={message.recId}
            isPlaying={isPlaying}
            onToggleAudio={onToggleAudio}
            onNavigateToCloset={onNavigateToCloset}
            onSaveToBoard={onSaveToBoard}
            pieceNotes={message.pieceNotes}
            stylingMoves={message.stylingMoves}
          />
        </View>
      </EditorialEntrance>
    );
  }

  if (!isUser && message.shopOutfit) {
    return (
      <EditorialEntrance fresh={fresh}>
        <View style={styles.shopCardContainer}>
          <View style={styles.sectionEyebrow}>
            <Ionicons name="bag-handle-outline" size={13} color={colors.primary} />
            <Text style={styles.sectionEyebrowText}>Shopping edit</Text>
          </View>
          <ShopOutfitCard
            compact={(message.responseVersion === 2 || message.responseVersion === 3)}
            outfit={message.shopOutfit}
            saveLabel={eventContext ? `${message.shopOutfit.recommendationType === 'piece' ? 'Add to wishlist' : 'Save list'} for ${eventContext.title}` : undefined}
            onSave={async () => {
              // addOutfitToWishlist mints the id client-side and POSTs it; only
              // offer to board the entry once the server has actually stored it,
              // or the board would reference an id the feed omits.
              const entry = await addOutfitToWishlist(message.shopOutfit!, eventContext);
              setSavedWishlistId(entry.id);
              track('outfit_saved_to_wishlist', { forEvent: !!eventContext });
            }}
            onViewSaved={onViewSaved ? () => {
              const id = savedWishlistId;
              if (id) onViewSaved(id);
            } : undefined}
            onSaveToBoard={onSaveToBoard ? () => {
              const id = savedWishlistId;
              if (id) onSaveToBoard({ type: 'wishlist', id });
            } : undefined}
          />
          {onToggleAudio && (
            <TouchableOpacity style={styles.quietAudioBtn} onPress={onToggleAudio} accessibilityLabel="Read shopping notes aloud">
              <Ionicons
                name={isPlaying ? 'pause-circle-outline' : 'volume-medium-outline'}
                size={18}
                color={colors.mutedForeground}
              />
              <Text style={styles.quietActionText}>{isPlaying ? 'Pause notes' : 'Listen to notes'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </EditorialEntrance>
    );
  }

  if (!isUser) {
    return (
      <EditorialEntrance fresh={fresh}>
        <View style={styles.stylistNote}>
          <View style={styles.sectionEyebrow}>
            <Text style={styles.sectionEyebrowText}>A note</Text>
          </View>
          <StylistRichText text={message.text} streaming={message.isStreaming} />
          {onToggleAudio && (
            <TouchableOpacity style={styles.quietAudioBtn} onPress={onToggleAudio} accessibilityLabel="Read stylist note aloud">
              <Ionicons
                name={isPlaying ? 'pause-circle-outline' : 'volume-medium-outline'}
                size={18}
                color={colors.mutedForeground}
              />
              <Text style={styles.quietActionText}>{isPlaying ? 'Pause' : 'Listen'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </EditorialEntrance>
    );
  }

  return (
    <View style={[styles.bubbleRow, styles.bubbleRowUser]}>
      <View style={[styles.bubble, styles.bubbleUser]}>
        {message.attachment ? (
          <View style={styles.userAttachment}>
            {message.attachment.items ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
                {message.attachment.photos?.map(photo => <Image key={photo.uri} source={{ uri: photo.uri }} style={styles.userAttachmentImage} accessibilityLabel="Attached photo" />)}
                {message.attachment.items.map((item) => item.uri ? <Image key={item.itemId} source={{ uri: item.uri }} style={styles.userAttachmentImage} accessibilityLabel={item.label} /> : <View key={item.itemId} style={styles.userAttachmentFallback}><Ionicons name="shirt-outline" size={19} color={colors.primaryForeground} /></View>)}
              </ScrollView>
            ) : message.attachment.uri ? (
              <Image source={{ uri: message.attachment.uri }} style={styles.userAttachmentImage} resizeMode="cover" />
            ) : (
              <View style={styles.userAttachmentFallback}>
                <Ionicons name={message.attachment.type === 'photo' ? 'image-outline' : 'shirt-outline'} size={19} color={colors.primaryForeground} />
              </View>
            )}
          </View>
        ) : null}
        <Text style={[styles.bubbleText, styles.bubbleTextUser]}>
          {message.text}{message.isStreaming ? '▍' : ''}
        </Text>
      </View>
    </View>
  );
}

// Only a reply that just arrived animates in; history appears already in place.
function EditorialEntrance({ fresh, children }: { fresh: boolean; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return <Reanimated.View entering={fresh && !reduceMotion ? FadeInUp.duration(240) : undefined}>{children}</Reanimated.View>;
}
