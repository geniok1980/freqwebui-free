import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer} from '@react-navigation/native';
import {View, Text, StyleSheet} from 'react-native';
import {DashboardScreen} from '../screens/DashboardScreen';
import {BotDetailScreen} from '../screens/BotDetailScreen';
import {AlertsScreen} from '../screens/AlertsScreen';
import {LoginScreen} from '../screens/LoginScreen';
import {FinanceDataScreen} from '../screens/FinanceDataScreen';
import {DiscoveryScreen} from '../screens/DiscoveryScreen';
import {AgentScreen} from '../screens/AgentScreen';
import {useAuthStore} from '../store/authStore';
import {theme} from '../theme';
import type {Bot} from '../types';

type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  BotDetail: {botId: string};
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const tabIcons: Record<string, string> = {
  Dashboard: '📊',
  Finance: '💰',
  Discovery: '🔍',
  Agent: '🤖',
  Alerts: '🔔',
};

function TabIcon({label, focused}: {label: string; focused: boolean}) {
  return (
    <View style={tabStyles.iconContainer}>
      <Text style={{fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6}}>
        {tabIcons[label] || '•'}
      </Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconContainer: {alignItems: 'center', justifyContent: 'center'},
});

function DashboardTab({navigation}: any) {
  const logout = useAuthStore(s => s.logout);

  const handleBotPress = (bot: Bot) => {
    navigation.navigate('BotDetail', {botId: bot.id});
  };

  return <DashboardScreen onBotPress={handleBotPress} onLogout={() => logout()} />;
}

function FinanceTab() {
  return <FinanceDataScreen />;
}

function DiscoveryTab() {
  return <DiscoveryScreen />;
}

function AgentTab() {
  return <AgentScreen />;
}

function AlertsTab() {
  return <AlertsScreen />;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.bgCard,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 6,
          height: 58,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: {fontSize: 10, fontWeight: '600'},
      }}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardTab}
        options={{
          tabBarLabel: 'Боты',
          tabBarIcon: ({focused}) => <TabIcon label="Dashboard" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Finance"
        component={FinanceTab}
        options={{
          tabBarLabel: 'Финансы',
          tabBarIcon: ({focused}) => <TabIcon label="Finance" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Discovery"
        component={DiscoveryTab}
        options={{
          tabBarLabel: 'Поиск',
          tabBarIcon: ({focused}) => <TabIcon label="Discovery" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Agent"
        component={AgentTab}
        options={{
          tabBarLabel: 'Агент',
          tabBarIcon: ({focused}) => <TabIcon label="Agent" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsTab}
        options={{
          tabBarLabel: 'События',
          tabBarIcon: ({focused}) => <TabIcon label="Alerts" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function Navigation() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isLoading = useAuthStore(s => s.isLoading);

  if (isLoading) {
    return (
      <View style={{flex: 1, backgroundColor: theme.colors.bg, justifyContent: 'center', alignItems: 'center'}}>
        <Text style={{color: theme.colors.textMuted}}>Загрузка...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: theme.colors.primary,
          background: theme.colors.bg,
          card: theme.colors.bgCard,
          text: theme.colors.text,
          border: theme.colors.border,
          notification: theme.colors.danger,
        },
        fonts: {
          regular: {fontFamily: 'System', fontWeight: '400'},
          medium: {fontFamily: 'System', fontWeight: '500'},
          bold: {fontFamily: 'System', fontWeight: '700'},
          heavy: {fontFamily: 'System', fontWeight: '800'},
        },
      }}>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="BotDetail" component={BotDetailWrapper} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function BotDetailWrapper({route, navigation}: any) {
  return (
    <BotDetailScreen botId={route.params.botId} onBack={() => navigation.goBack()} />
  );
}
