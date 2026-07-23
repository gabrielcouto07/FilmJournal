import SwiftUI
import Charts
import Kit
import DesignKit

/// Espelha `CountrySpread` em `PalateCharts.tsx` — barras horizontais por país de origem.
struct CountrySpreadChart: View {
    let data: [CountryCount]

    var body: some View {
        Chart(data) { row in
            BarMark(
                x: .value("Filmes", row.count),
                y: .value("País", CountryNames.label(for: row.code))
            )
            .foregroundStyle(Color.fjAccent)
            .cornerRadius(4)
            .annotation(position: .trailing) {
                Text("\(row.count)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.fjMuted)
            }
        }
        .chartXAxis(.hidden)
        .chartYAxis {
            AxisMarks { value in
                AxisValueLabel {
                    if let label = value.as(String.self) {
                        Text(label).font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.fjTextSoft)
                    }
                }
            }
        }
        .frame(height: max(200, CGFloat(data.count) * 34))
    }
}
