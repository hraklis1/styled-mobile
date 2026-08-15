export type Event = {
  id: number;
  userId: number;
  title: string;
  date: string;            // ISO timestamp string from backend
  occasion: string;        // not nullable in schema
  location: string | null;
  notes: string | null;
  environment: string | null;
  itemIds: number[] | null;
  outfitId: number | null;
  /**
   * The board this event was planned from, if any. Optional rather than
   * required: a client can briefly outrun the backend deploy that adds the
   * column, in which case the field is simply absent from the response.
   */
  boardId?: number | null;
};
