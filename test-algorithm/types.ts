export interface TradeInfo {
	exitDatetime: Date;
	entryDatetime: Date;
	mode: string;
	entryPrice: number;
	entryAmountUSD: number;
	exitPrice: number;
	algo: string;
	profitAbsolute: number;
	profitPercent: number;
}
