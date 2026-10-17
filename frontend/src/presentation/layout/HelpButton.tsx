import { CircleHelp } from 'lucide-react'
import { useState } from 'react'

import { Badge, Button, Dialog, IconButton } from '../ui'
import styles from './HelpButton.module.css'

/** Modelos do Sketchfab (CC BY 4.0) do galpão e dos tipos de carga; o texto completo está nos CREDITS.md. */
const MODEL_CREDITS: readonly { title: string; author: string; uid: string }[] = [
  { title: 'Hangar', author: 'nermin', uid: '64f7d287f5274029bc29755a9839ebbf' },
  { title: 'Wooden Crate', author: 'Memorie', uid: '2a3ac54357bb4b92bfbc119111c09fd1' },
  { title: 'Shipping Container', author: 'BeaVex', uid: '429e58a328374df4921b8a12bc142b28' },
  {
    title: 'Old Pipes Bundle – Modular Industrial Pack',
    author: 'Alex_Krush',
    uid: 'fbe3129ea77243ca92c8219f269ac5cf',
  },
  { title: 'Diesel generator', author: 'epilogueronin', uid: '7a0b72c7d01944a8aafab59d44eb120e' },
  { title: 'Electrical Transformer', author: 'abass20', uid: '615fe4b367314a72b7dffb8ec791f575' },
  {
    title: 'Concrete Channel Beam Set',
    author: 'kcproductions211',
    uid: '3109773bb88a4c8796ca6845c26c7997',
  },
  {
    title: 'Concrete_beam_tubgirder',
    author: 'kcproductions211',
    uid: '4e7d470a86854299bcb86c5c19b33111',
  },
]

/** Botão de ajuda da barra superior: explica o que é oficial, o que é FICTÍCIO e como usar a cena. */
export function HelpButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconButton
        label="Ajuda"
        icon={<CircleHelp size={18} />}
        tooltip="bottom"
        onClick={() => setOpen(true)}
      />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Como ler o simulador"
        description="O que vem do servidor, o que é pré-visualização e como mexer na cena."
        footer={
          <Button variant="primary" onClick={() => setOpen(false)}>
            Entendi
          </Button>
        }
      >
        <dl className={styles.list}>
          <div>
            <dt>Resultado</dt>
            <dd>
              Capacidade, utilização e “não avaliável” vêm do servidor, com a tabela ativa da
              configuração.
            </dd>
          </div>
          <div>
            <dt>
              Geometria <Badge tone="neutral">pré-visualização</Badge>
            </dt>
            <dd>
              O raio e as alturas em “Detalhes”, no cartão de resultado, são uma prévia; o resultado
              oficial é o da avaliação.
            </dd>
          </div>
          <div>
            <dt>
              Cores da situação <Badge tone="ok">verde</Badge> <Badge tone="danger">vermelho</Badge>{' '}
              <Badge tone="neutral">cinza</Badge>
            </dt>
            <dd>
              Verde: dentro da capacidade. Âmbar: perto do limite do guindaste. Vermelho: acima do
              limite. Cinza: sem avaliação ou fora da tabela de carga.
            </dd>
          </div>
          <div>
            <dt>Cena 3D</dt>
            <dd>
              Arraste para girar a câmera e role para aproximar. Os controles da barra de comando,
              embaixo da cena, têm teclado: setas, Home, End, PageUp e PageDown.
            </dd>
          </div>
          <div>
            <dt>Painéis e atalhos</dt>
            <dd>
              A barra à esquerda abre uma folha por vez (Configurar, Acessórios, Ambiente, Tandem,
              Planejar e Gravações); clique de novo no botão ou tecle Esc para fechar. Teclas 1, 2,
              3 e 4 escolhem a vista: perspectiva, lateral, topo e operador. “Ocultar painéis” deixa
              só a cena e a barra de vistas.
            </dd>
          </div>
        </dl>
        <p className={styles.credit}>
          Modelo 3D do guindaste:{' '}
          <a
            href="https://sketchfab.com/3d-models/80-ton-hydraulic-crane-oilfield-completions-27cbfdf2ef094d6283aa634ad6fb45c6"
            target="_blank"
            rel="noreferrer"
          >
            80-Ton Hydraulic Crane | Oilfield Completions
          </a>
          , de awilliams1337,{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
          .
        </p>
        <p className={styles.credit}>
          Modelos 3D do galpão e das cargas (
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
          ):{' '}
          {MODEL_CREDITS.map(({ title, author, uid }, index) => (
            <span key={uid}>
              {index > 0 && '; '}
              <a href={`https://sketchfab.com/3d-models/${uid}`} target="_blank" rel="noreferrer">
                {title}
              </a>
              , de {author}
            </span>
          ))}
          .
        </p>
      </Dialog>
    </>
  )
}
