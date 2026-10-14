import { Box, Construction, House, Trees, Truck, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  OBJECT_CATEGORY_LABELS,
  OBJECT_LIBRARY,
  type ObjectCategory,
  type LibraryObject,
  libraryObjectsIn,
  usedCategories,
} from '../../domain/environment/objectLibrary'
import {
  startThumbnails,
  subscribeThumbnails,
  thumbnailImages,
} from '../../three/scene/objectThumbnails'
import { cx } from '../ui'
import styles from './ObjectLibraryPalette.module.css'

const CATEGORY_ICONS: Readonly<Record<ObjectCategory, LucideIcon>> = {
  vegetacao: Trees,
  edificacao: House,
  veiculo: Truck,
  guindaste: Construction,
  outro: Box,
}

const meters = (value: number): string =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

function sizeCaption(object: LibraryObject): string {
  const { w, d, h } = object.baseSize
  return `${meters(w)} × ${meters(d)} × ${meters(h)} m`
}

export interface ObjectLibraryPaletteProps {
  /** Objeto escolhido (o que o próximo clique no chão coloca), ou `null`. */
  readonly selectedId: string | null
  onSelect(id: string): void
}

/**
 * Paleta "Biblioteca" do editor 3D do ambiente (TASK-072; ADR-036): árvores, construções, veículos e
 * outros objetos em escala real, por categoria. Escolher um objeto arma o clique no chão. As
 * miniaturas vêm dos próprios modelos; sem WebGL, vale o ícone da categoria.
 */
export function ObjectLibraryPalette({ selectedId, onSelect }: ObjectLibraryPaletteProps) {
  const categories = usedCategories()
  const selectedCategory = OBJECT_LIBRARY.find((object) => object.id === selectedId)?.category
  const [category, setCategory] = useState<ObjectCategory>(
    selectedCategory ?? categories[0] ?? 'outro',
  )
  const [thumbnails, setThumbnails] = useState<ReadonlyMap<string, string>>(
    () => new Map(thumbnailImages()),
  )

  useEffect(() => {
    // Cada miniatura aparece assim que fica pronta; as já prontas vêm de visitas anteriores.
    const unsubscribe = subscribeThumbnails(() => setThumbnails(new Map(thumbnailImages())))
    void startThumbnails(OBJECT_LIBRARY)
    return unsubscribe
  }, [])

  const Icon = CATEGORY_ICONS[category]
  return (
    <div className={styles.palette} role="group" aria-label="Biblioteca de objetos">
      <div className={styles.categories} role="group" aria-label="Categoria">
        {categories.map((item) => {
          const CategoryIcon = CATEGORY_ICONS[item]
          return (
            <button
              key={item}
              type="button"
              className={cx(styles.category, category === item && styles.categoryOn)}
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
            >
              <CategoryIcon size={14} aria-hidden="true" />
              {OBJECT_CATEGORY_LABELS[item]}
            </button>
          )
        })}
      </div>
      <ul className={styles.items}>
        {libraryObjectsIn(category).map((object) => (
          <li key={object.id}>
            <button
              type="button"
              className={cx(styles.item, selectedId === object.id && styles.itemOn)}
              aria-pressed={selectedId === object.id}
              title={`${object.label} (${sizeCaption(object)})`}
              onClick={() => onSelect(object.id)}
            >
              <span className={styles.thumb}>
                {thumbnails.has(object.id) ? (
                  <img src={thumbnails.get(object.id)} alt="" width={44} height={44} />
                ) : (
                  <Icon size={22} aria-hidden="true" />
                )}
              </span>
              <span className={styles.name}>{object.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
