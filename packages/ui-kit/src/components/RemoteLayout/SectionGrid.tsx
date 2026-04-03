import React, { useState } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import type { LayoutSection, RemoteWidget } from '@remote/core';
import { ButtonW }    from './widgets/ButtonW';
import { DPadW }     from './widgets/DPadW';
import { RockerW }   from './widgets/RockerW';
import { TouchpadW } from './widgets/TouchpadW';
import { TextInputW } from './widgets/TextInputW';
import type { TextInputWHandle } from './widgets/TextInputW';
import { VoiceW }    from './widgets/VoiceW';

interface Props {
  section: LayoutSection;
  onAction: (action: string) => void;
  /** Called with the text-input widget's imperative handle when it mounts. */
  onRegisterTextInput?: (handle: TextInputWHandle) => void;
}

interface CellLayout {
  left: number;
  top: number;
  width: number;
  height: number;
}

function computeCell(
  w: RemoteWidget,
  containerWidth: number,
  columns: number,
  rowHeight: number,
  gap: number,
): CellLayout {
  const colSpan = w.colSpan ?? 1;
  const rowSpan = w.rowSpan ?? 1;
  const cellW   = (containerWidth - gap * (columns + 1)) / columns;

  return {
    left:   w.col  * cellW  + (w.col  + 1) * gap,
    top:    w.row  * rowHeight + (w.row  + 1) * gap,
    width:  colSpan * cellW  + (colSpan - 1) * gap,
    height: rowSpan * rowHeight + (rowSpan - 1) * gap,
  };
}

function containerHeight(section: LayoutSection, rowHeight: number, gap: number): number {
  const maxRow = Math.max(
    ...section.widgets.map(w => w.row + (w.rowSpan ?? 1)),
    0,
  );
  return maxRow * rowHeight + (maxRow + 1) * gap;
}

function renderWidget(
  widget: RemoteWidget,
  onAction: (a: string) => void,
  onRegisterTextInput?: (h: TextInputWHandle) => void,
): React.ReactNode {
  switch (widget.type) {
    case 'button':
      return <ButtonW    key={widget.id} widget={widget} onAction={onAction} />;
    case 'dpad':
      return <DPadW     key={widget.id} widget={widget} onAction={onAction} />;
    case 'rocker':
      return <RockerW   key={widget.id} widget={widget} onAction={onAction} />;
    case 'touchpad':
      return <TouchpadW key={widget.id} widget={widget} onAction={onAction} />;
    case 'text-input':
      return (
        <TextInputW
          key={widget.id}
          widget={widget}
          onAction={onAction}
          ref={onRegisterTextInput ? (h: TextInputWHandle | null) => { if (h) onRegisterTextInput(h); } : null}
        />
      );
    case 'voice':
      return <VoiceW     key={widget.id} widget={widget} onAction={onAction} />;
    default:
      return null;
  }
}

export function SectionGrid({ section, onAction, onRegisterTextInput }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);

  const gap       = section.gap       ?? 8;
  const rowHeight = section.rowHeight ?? 72;

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const gridH = containerWidth > 0
    ? containerHeight(section, rowHeight, gap)
    : 0;

  return (
    <View onLayout={onLayout} style={{ width: '100%', height: gridH, position: 'relative' }}>
      {containerWidth > 0 && section.widgets.map(widget => {
        const cell = computeCell(widget, containerWidth, section.columns, rowHeight, gap);
        return (
          <View
            key={widget.id}
            style={{
              position: 'absolute',
              left:   cell.left,
              top:    cell.top,
              width:  cell.width,
              height: cell.height,
            }}
          >
            {renderWidget(widget, onAction, onRegisterTextInput)}
          </View>
        );
      })}
    </View>
  );
}
