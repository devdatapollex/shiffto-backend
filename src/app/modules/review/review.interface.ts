export interface ICreateReviewPayload {
  shipmentId: string;
  rating: number;
  comment?: string;
}

export interface IReviewPaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  rating?: number;
}
