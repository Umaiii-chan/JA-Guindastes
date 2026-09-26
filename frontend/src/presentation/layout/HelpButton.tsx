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
        description="O que vem do backend, o que é pré-visualização e como mexer na cena."
        footer={
          <Button variant="primary" onClick={() => setOpen(false)}>
            Entendi
          </Button>
        }
      >
        <dl className={styles.list}>
          <div>
            <dt>
              Resultado <Badge tone="info">backend</Badge>
            </dt>
            <dd>
              Capacidade, utilização e “não avaliável” vêm do backend, com a tabela ativa da
              configuração. É o valor que vale (RN-008).
            </dd>
          </div>
          <div>
            <dt>
              Geometria <Badge tone="neutral">pré-visualização</Badge>
            </dt>
            <dd>
              O raio e as alturas calculados no navegador servem só para acompanhar a cena (ADR-013
              C-7).
            </dd>
          </div>
          <div>
            <dt>
              Cores da situação <Badge tone="ok">verde</Badge> <Badge tone="warning">âmbar</Badge>{' '}
              <Badge tone="danger">vermelho</Badge> <Badge tone="neutral">cinza</Badge>
            </dt>
            <dd>
              Verde: carga abaixo da capacidade. Âmbar: carga igual à capacidade (caso ainda sem
              regra). Vermelho: acima da capacidade. Cinza: sem avaliação ou não avaliável. Não há
              níveis de alerta definidos (PEND-004).
            </dd>
          </div>
          <div>
            <dt>
              Marcas <Badge tone="warning">FICTÍCIO</Badge> <Badge tone="warning">PROVISÓRIO</Badge>
            </dt>
            <dd>
              Os dados de teste são fictícios (ADR-012) e a capacidade vem da consulta conservadora
              provisória (ADR-015).
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
      </Dialog>
    </>
  )
}
