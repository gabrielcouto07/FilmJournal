import SwiftUI
import Charts
import Kit
import DesignKit

/// Espelha `DecadeHistogram` em `PalateCharts.tsx` — filmes avaliados agrupados por década.
struct DecadeHistogramChart: View {
    let data: [DecadeBucket]

    var body: some View {
        Chart(data) { bucket in
            BarMark(
                x: .value("Década", bucket.label),
                y: .value("Filmes", bucket.count)
            )
            .foregroundStyle(Color.fjAccent)
            .cornerRadius(4)
            .annotation(position: .top) {
                Text("\(bucket.count)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.fjMuted)
            }
        }
        .chartYAxis(.hidden)
        .chartXAxis {
            AxisMarks { value in
                AxisValueLabel {
                    if let label = value.as(String.self) {
                        Text(label).font(.system(size: 11, weight: .bold)).foregroundStyle(Color.fjMuted)
                    }
                }
            }
        }
        .frame(height: 200)
    }
}
