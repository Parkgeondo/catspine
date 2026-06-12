import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  AccessibilityInfo,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { theme } from './src/theme';
import { CATS, CAT_BY_ID } from './src/cats';
import CatStage from './src/game/CatStage';
import RankingModal from './src/ui/RankingModal';
import { createGameState, spin as spinState, TANTRUM_LINES } from './src/game/engine';
import { startSession } from './src/ranking/ranking';

const CALM_MOOD = '좋아요! 한 번 더? 🌀';

export default function App() {
  const game = useRef(createGameState(Date.now())).current;

  const [score, setScore] = useState(0);
  const [mood, setMood] = useState('고양이를 한 번 돌려보세요!');
  const [angry, setAngry] = useState(false);
  const [catId, setCatId] = useState(CATS[0].id);
  const [rankOpen, setRankOpen] = useState(false);
  const [loadStatus, setLoadStatus] = useState('🐈 모델 로딩 중…');
  const reduceMotion = useRef(false);

  // boot: restore cat choice, reduce-motion pref, and a ranking session
  useEffect(() => {
    AsyncStorage.getItem('catId').then((v) => {
      if (v && CAT_BY_ID[v]) setCatId(v);
    });
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduceMotion.current = v;
    });
    startSession();
  }, []);

  function spin() {
    spinState(game, Date.now());
    if (angry) {
      setAngry(false);
      setMood(CALM_MOOD);
    }
  }

  function onScore(next) {
    setScore(next);
    game.submitted = false;
    AccessibilityInfo.announceForAccessibility(`${next}점`);
  }

  function onMood(level) {
    if (level === 0) {
      setAngry(false);
      setMood(score > 0 ? CALM_MOOD : '고양이를 한 번 돌려보세요!');
    } else {
      const line = TANTRUM_LINES[level - 1];
      setAngry(true);
      setMood(line);
      AccessibilityInfo.announceForAccessibility(line);
    }
  }

  function selectCat(id) {
    if (!CAT_BY_ID[id]) return;
    setCatId(id);
    AsyncStorage.setItem('catId', id);
    game.lastInteraction = Date.now();
    if (angry) {
      setAngry(false);
      setMood(CALM_MOOD);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />

      {/* HUD */}
      <View style={styles.hud}>
        <View style={styles.scoreBox} accessibilityLabel={`현재 점수 ${score}점`}>
          <Text style={styles.scoreLabel}>점수</Text>
          <Text style={styles.scoreValue}>{score}</Text>
        </View>
        <Pressable style={styles.ghostBtn} onPress={() => setRankOpen(true)}>
          <Text style={styles.ghostBtnText}>🏆 랭킹</Text>
        </Pressable>
      </View>

      {/* 3D stage — tap anywhere on it to spin */}
      <View style={styles.stage}>
        <CatStage
          game={game}
          catId={catId}
          reduceMotion={reduceMotion.current}
          onScore={onScore}
          onMood={onMood}
          onStatus={setLoadStatus}
        />
        <Text style={styles.debugStatus} pointerEvents="none">
          {loadStatus}
        </Text>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={spin}
          accessibilityLabel="고양이 돌리기"
          accessibilityRole="button"
        />
      </View>

      {/* action bar */}
      <Text style={[styles.mood, angry && styles.moodAngry]}>{mood}</Text>
      <Pressable style={styles.spinBtn} onPress={spin} accessibilityRole="button">
        <Text style={styles.spinBtnText}>🌀 돌리기</Text>
      </Pressable>

      {/* cat picker */}
      <View style={styles.picker}>
        {CATS.map((cat) => {
          const active = cat.id === catId;
          return (
            <Pressable
              key={cat.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => selectCat(cat.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${cat.name} 고양이`}
            >
              <Text style={styles.chipEmoji}>{cat.emoji}</Text>
              <Text style={[styles.chipName, active && styles.chipNameActive]}>{cat.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <RankingModal
        visible={rankOpen}
        onClose={() => setRankOpen(false)}
        score={score}
        catId={catId}
        onSubmitted={() => {
          game.submitted = true;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 16 },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  scoreBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    backgroundColor: theme.panel,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  scoreLabel: { color: theme.textDim, fontSize: 13, fontWeight: '600' },
  scoreValue: { color: theme.text, fontSize: 26, fontWeight: '900' },
  ghostBtn: {
    backgroundColor: theme.panel,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  ghostBtnText: { color: theme.text, fontSize: 15, fontWeight: '700' },
  stage: { flex: 1, marginVertical: 8 },
  debugStatus: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: theme.textDim,
    fontSize: 12,
  },
  mood: {
    color: theme.textDim,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  moodAngry: { color: theme.angry, fontWeight: '800' },
  spinBtn: {
    backgroundColor: theme.accent,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: theme.accent,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  spinBtnText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 14,
    marginBottom: 8,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: theme.panel,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: { borderColor: theme.accentSoft, backgroundColor: theme.panelSoft },
  chipEmoji: { fontSize: 22 },
  chipName: { color: theme.textDim, fontSize: 13, marginTop: 2, fontWeight: '600' },
  chipNameActive: { color: theme.text },
});
