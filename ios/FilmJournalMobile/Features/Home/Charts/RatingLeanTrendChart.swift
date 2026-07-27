import SwiftUI
import Charts
import Kit
import DesignKit

/// Nota média e distância do público, ano a ano.
struct RatingLeanTrendChart: View {
    let years: [TimelineYear]

    // Swift Charts não tem eixo Y duplo: a distância do público (-2...2) é remapeada para 0...5
    // só para desenhar na mesma escala. Os valores reais só aparecem nas anotações.
    private func mappedLean(_ lean: Double) -> Double { 2.5 + lean * 1.25 }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Chart(years) { year in
                if let rating = year.averageRating {
                    LineMark(
                        x: .value("Ano", year.year),
                        y: .value("Nota", rating),
                        series: .value("Série", "rating")
                    )
                    .foregroundStyle(Color.fjAccent)
                    .lineStyle(StrokeStyle(lineWidth: 2.5))
                    .symbol(Circle())
                    .symbolSize(30)
                }
                if let lean = year.tasteLean {
                    LineMark(
                        x: .value("Ano", year.year),
                        y: .value("Distância (remapeada)", mappedLean(lean)),
                        series: .value("Série", "lean")
                    )
                    .foregroundStyle(Color.fjBlue)
                    .lineStyle(StrokeStyle(lineWidth: 2, dash: [6, 4]))
                    .symbol(Circle())
                    .symbolSize(30)
                }
            }
            .chartYScale(domain: 0...5)
            .chartXAxis {
                AxisMarks { AxisValueLabel().font(.system(size: 10, weight: .bold)).foregroundStyle(Color.fjMuted) }
            }
            .chartYAxis {
                AxisMarks(values: [0, 1, 2, 3, 4, 5]) { _ in
                    AxisValueLabel().font(.system(size: 10, weight: .bold)).foregroundStyle(Color.fjMuted)
                }
            }
            .frame(height: 220)

            HStack(spacing: Spacing.md) {
                HStack(spacing: 4) {
                    Circle().fill(Color.fjAccent).frame(width: 8, height: 8)
                    Text("Sua nota média")
                }
                HStack(spacing: 4) {
                    Circle().fill(Color.fjBlue).frame(width: 8, height: 8)
                    Text("Distância do público (+ generoso / − exigente)")
                }
            }
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(Color.fjMuted)
        }
    }
}
