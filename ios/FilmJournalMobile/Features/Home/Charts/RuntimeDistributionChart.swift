import SwiftUI
import Charts
import Kit
import DesignKit

/// Espelha `RuntimeDistribution` em `PalateCharts.tsx` — filmes agrupados por duração, com a
/// faixa mais comum ("faixa preferida") destacada.
struct RuntimeDistributionChart: View {
    let data: [RuntimeBucket]

    var body: some View {
        Chart(data) { bucket in
            BarMark(
                x: .value("Duração", bucket.label),
                y: .value("Filmes", bucket.count)
            )
            .foregroundStyle(bucket.sweetSpot ? Color.fjAccent : Color.fjAccent.opacity(0.28))
            .cornerRadius(4)
            .annotation(position: .top) {
                if bucket.sweetSpot {
                    Text("★ \(bucket.count)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.fjAccent)
                } else {
                    Text("\(bucket.count)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.fjMuted)
                }
            }
        }
        .chartYAxis(.hidden)
        .chartXAxis {
            AxisMarks { value in
                AxisValueLabel {
                    if let label = value.as(String.self) {
                        Text(label).font(.system(size: 10, weight: .bold)).foregroundStyle(Color.fjMuted)
                    }
                }
            }
        }
        .frame(height: 200)
    }
}
