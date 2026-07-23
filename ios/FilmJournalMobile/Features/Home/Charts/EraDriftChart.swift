import SwiftUI
import Charts
import Kit
import DesignKit

/// Espelha `EraDrift` em `EvolutionCharts.tsx` — ano médio de lançamento dos filmes assistidos,
/// por ano do diário. Só faz sentido com diário em 2+ anos; ver nota em `HomeChartsSection.swift`
/// sobre por que fica comentado por padrão junto dos outros gráficos de evolução.
struct EraDriftChart: View {
    let years: [TimelineYear]

    private var yDomain: ClosedRange<Double> {
        let values = years.compactMap(\.averageFilmYear)
        guard let min = values.min(), let max = values.max() else { return 1900...2030 }
        let lowerBound = ((min - 4) / 10).rounded(.down) * 10
        let upperBound = ((max + 4) / 10).rounded(.up) * 10
        return lowerBound...upperBound
    }

    var body: some View {
        Chart(years) { year in
            if let avg = year.averageFilmYear {
                LineMark(x: .value("Ano", year.year), y: .value("Época média", avg))
                    .foregroundStyle(Color.fjAccent)
                    .lineStyle(StrokeStyle(lineWidth: 2.5))
                    .symbol(Circle())
                    .symbolSize(30)
            }
        }
        .chartYScale(domain: yDomain)
        .chartXAxis {
            AxisMarks { AxisValueLabel().font(.system(size: 10, weight: .bold)).foregroundStyle(Color.fjMuted) }
        }
        .chartYAxis {
            AxisMarks { AxisValueLabel().font(.system(size: 10, weight: .bold)).foregroundStyle(Color.fjMuted) }
        }
        .frame(height: 220)
    }
}
