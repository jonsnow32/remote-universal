import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { TextInputWidget } from '@remote/core';
import { Ionicons } from '@react-native-vector-icons/ionicons';

interface Props {
  widget: TextInputWidget;
  onAction: (action: string) => void;
}

export function TextInputW({ widget, onAction }: Props) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const open = () => {
    setText('');
    setVisible(true);
    // focus after modal fully opens
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const submit = () => {
    if (!text.trim()) return;
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
          backgroundColor: '#0E1420',
          borderWidth: 1,
          borderColor: '#1A2030',
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
          color="#8892A4"
        />
        <Text style={{ color: '#555E74', fontSize: 13 }}>
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
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}
          onPress={() => setVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Pressable
              onPress={() => {/* stop propagation */}}
              style={{
                backgroundColor: '#131929',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: 20,
                paddingBottom: Platform.OS === 'ios' ? 36 : 20,
              }}
            >
              <Text style={{ color: '#8892A4', fontSize: 13, marginBottom: 12 }}>
                {widget.placeholder ?? 'Search'}
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#0E1420',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#2A3448',
                  paddingHorizontal: 14,
                  gap: 10,
                }}
              >
                <Ionicons
                  name={(widget.icon ?? 'search-outline') as React.ComponentProps<typeof Ionicons>['name']}
                  size={18}
                  color="#555E74"
                />
                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={setText}
                  onSubmitEditing={submit}
                  returnKeyType="search"
                  placeholder={widget.placeholder ?? 'Type to search…'}
                  placeholderTextColor="#3C4560"
                  style={{ flex: 1, color: '#E2E8F7', fontSize: 15, paddingVertical: 12 }}
                  autoCorrect={false}
                />
                {text.length > 0 && (
                  <Pressable onPress={() => setText('')}>
                    <Ionicons name="close-circle" size={18} color="#555E74" />
                  </Pressable>
                )}
              </View>

              <Pressable
                onPress={submit}
                style={({ pressed }) => ({
                  marginTop: 14,
                  backgroundColor: '#4A6EE0',
                  borderRadius: 12,
                  paddingVertical: 13,
                  alignItems: 'center',
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Search</Text>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </>
  );
}
