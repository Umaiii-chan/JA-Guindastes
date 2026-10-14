import { CircleHelp } from 'lucide-react'
import { useState } from 'react'

import { Badge, Button, Dialog, IconButton } from '../ui'
import styles from './HelpButton.module.css'

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
              O raio e as alturas mostrados ao lado da cena são uma prévia; o resultado oficial é o
              da avaliação.
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
              Arraste para girar a câmera e role para aproximar. Os controles do passo “Posição” têm
              teclado: setas, Home, End, PageUp e PageDown.
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
      </Dialog>
    </>
  )
}
