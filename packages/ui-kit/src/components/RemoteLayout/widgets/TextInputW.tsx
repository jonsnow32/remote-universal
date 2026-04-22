import React, { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import type { TextInputWidget } from '@remote/core';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../../theme/ThemeProvider';

export interface TextInputWHandle {
  /** Open the modal pre-filled with [initialText] and optional [hint] (TV-driven open). */
  openWithText: (initialText: string, hint?: string) => void;
}

interface Props {
  widget: TextInputWidget;
  onAction: (action: string) => void;
}

export const TextInputW = forwardRef<TextInputWHandle, Props>(function TextInputW(
  { widget, onAction }: Props,
  ref,
) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const [tvHint, setTvHint] = useState('');
  const inputRef = useRef<TextInput>(null);

  const openModal = (initialText: string, hint?: string) => {
    setText(initialText);
    if (hint !== undefined) setTvHint(hint);
    setVisible(true);
    onAction('KEYBOARD_OPEN');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const open = () => openModal('');

  // Expose openWithText so RemoteScreen can drive keyboard open from TV event.
  useImperativeHandle(ref, () => ({
    openWithText: (initialText: string, hint?: string) => openModal(initialText, hint),
  }));

  const handleChangeText = (newText: string) => {
    setText(newText);
    onAction(`KEYBOARD_INPUT:${newText}`);
  };

  const submit = () => {
    onAction(`${widget.action}:${text.trim()}`);
    setVisible(false);
  };

  return (
    <>
      {/* ── Trigger button ── */}
      <Pressable
        onPress={open}
        style={({ pressed }) => ({
          flex: 1,
          borderRadius: 12,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons
          name={(widget.icon ?? 'search-outline') as React.ComponentProps<typeof Ionicons>['name']}
          size={18}
          color={theme.colors.textSecondary}
        />
        <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.typography.fontFamily }}>
          {widget.placeholder ?? 'Search…'}
        </Text>
      </Pressable>

      {/* ── Input modal ── */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Backdrop — tap to dismiss */}
          <Pressable
            style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' }}
            onPress={() => setVisible(false)}
          />

          {/* Sheet content — stops backdrop press from propagating */}
          <Pressable
            onPress={() => {/* stop propagation */}}
            style={{
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              paddingBottom: Platform.OS === 'ios' ? 36 : 20,
            }}
          >
              {/* ── Mirror hint ── */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.success }} />
                <Text style={{ color: theme.colors.success, fontSize: 12, fontWeight: '600', fontFamily: theme.typography.fontFamily }}>
                  Mirroring to TV keyboard
                </Text>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.colors.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  paddingHorizontal: 14,
                  gap: 10,
                }}
              >
                <Ionicons
                  name={(widget.icon ?? 'search-outline') as React.ComponentProps<typeof Ionicons>['name']}
                  size={18}
                  color={theme.colors.textSecondary}
                />
                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={handleChangeText}
                  onSubmitEditing={submit}
                  returnKeyType="search"
                  placeholder={tvHint || widget.placeholder || 'Type to search…'}
                  placeholderTextColor={theme.colors.textSecondary}
                  style={{ flex: 1, color: theme.colors.text, fontSize: 15, paddingVertical: 12, fontFamily: theme.typography.fontFamily }}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {text.length > 0 && (
                  <Pressable onPress={() => handleChangeText('')}>
                    <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
                  </Pressable>
                )}
              </View>

              <Pressable
                onPress={submit}
                style={({ pressed }) => ({
                  marginTop: 14,
                  backgroundColor: theme.colors.primary,
                  borderRadius: 12,
                  paddingVertical: 13,
                  alignItems: 'center',
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15, fontFamily: theme.typography.fontFamilyBold }}>Search on TV</Text>
              </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
});
