import SwiftUI
import Kit
import DesignKit

/// Espelha a "Distribuição de notas" em `TasteDashboard.tsx` — o web usa barras de progresso
/// simples (não Recharts) para esta seção, então reproduzimos o mesmo desenho aqui.
struct RatingDistributionChart: View {
    let data: [RatingBucket]

    private var maxCount: Int { max(1, data.map(\.count).max() ?? 1) }

    var body: some View {
        VStack(spacing: Spacing.sm) {
            ForEach(data) { bucket in
                HStack(spacing: Spacing.sm) {
                    Text(String(format: "%.1f", bucket.rating))
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(Color.fjAccent)
                        .frame(width: 30, alignment: .leading)

                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.fjLine)
                            Capsule()
                                .fill(Color.fjAccent.opacity(0.7))
                                .frame(width: geometry.size.width * CGFloat(bucket.count) / CGFloat(maxCount))
                        }
                    }
                    .frame(height: 10)

                    Text("\(bucket.count)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.fjMuted)
                        .frame(width: 28, alignment: .trailing)
                }
            }
        }
    }
}
