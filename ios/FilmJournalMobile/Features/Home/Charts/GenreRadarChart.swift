import SwiftUI
import Kit
import DesignKit

/// Espelha `GenreRadar` em `PalateCharts.tsx` — o Swift Charts framework não tem um tipo de
/// radar/polar nativo, então este é um desenho customizado via `Canvas`.
///
/// Mais pesado que os outros gráficos (matemática de polígono à mão); seu uso na Home fica
/// comentado por padrão em `HomeChartsSection.swift` — descomente lá para testar.
struct GenreRadarChart: View {
    let data: [GenreCount]

    private var maxValue: Int { max(1, data.map(\.count).max() ?? 1) }

    private func point(index: Int, radius: CGFloat, center: CGPoint) -> CGPoint {
        let angle = Angle.degrees(-90 + (360.0 / Double(data.count)) * Double(index))
        return CGPoint(x: center.x + radius * cos(angle.radians), y: center.y + radius * sin(angle.radians))
    }

    var body: some View {
        if data.count < 3 {
            InsufficientDataView()
        } else {
            Canvas { context, size in
                let center = CGPoint(x: size.width / 2, y: size.height / 2)
                let maxRadius = min(size.width, size.height) / 2 - 32

                for ring in 1...4 {
                    let ringRadius = maxRadius * CGFloat(ring) / 4
                    var ringPath = Path()
                    for index in data.indices {
                        let p = point(index: index, radius: ringRadius, center: center)
                        index == 0 ? ringPath.move(to: p) : ringPath.addLine(to: p)
                    }
                    ringPath.closeSubpath()
                    context.stroke(ringPath, with: .color(Color.fjLine), lineWidth: 1)
                }

                for index in data.indices {
                    var axisPath = Path()
                    axisPath.move(to: center)
                    axisPath.addLine(to: point(index: index, radius: maxRadius, center: center))
                    context.stroke(axisPath, with: .color(Color.fjLine), lineWidth: 1)
                }

                var dataPath = Path()
                for (index, item) in data.enumerated() {
                    let radius = maxRadius * CGFloat(item.count) / CGFloat(maxValue)
                    let p = point(index: index, radius: radius, center: center)
                    index == 0 ? dataPath.move(to: p) : dataPath.addLine(to: p)
                }
                dataPath.closeSubpath()
                context.fill(dataPath, with: .color(Color.fjAccent.opacity(0.28)))
                context.stroke(dataPath, with: .color(Color.fjAccent), lineWidth: 2)

                for (index, item) in data.enumerated() {
                    let p = point(index: index, radius: maxRadius + 14, center: center)
                    context.draw(
                        Text(item.genre).font(.system(size: 9, weight: .semibold)).foregroundColor(Color.fjTextSoft),
                        at: p
                    )
                }
            }
            // Quadrado que acompanha a largura disponível — evita sobrar espaço vertical quando
            // o gráfico divide a linha com outro card (a largura, não uma altura fixa, manda).
            .aspectRatio(1, contentMode: .fit)
        }
    }
}
