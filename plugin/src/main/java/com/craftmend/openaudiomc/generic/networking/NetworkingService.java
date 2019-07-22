package com.craftmend.openaudiomc.generic.networking;

import com.craftmend.openaudiomc.OpenAudioMcCore;
import com.craftmend.openaudiomc.generic.networking.client.objects.ClientConnection;
import com.craftmend.openaudiomc.generic.networking.enums.PacketChannel;
import com.craftmend.openaudiomc.generic.networking.handlers.ClientConnectHandler;

import com.craftmend.openaudiomc.generic.networking.abstracts.AbstractPacket;
import com.craftmend.openaudiomc.generic.networking.abstracts.PayloadHandler;
import com.craftmend.openaudiomc.generic.networking.handlers.ClientDisconnectHandler;
import com.craftmend.openaudiomc.generic.networking.io.SocketIoConnector;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class NetworkingService {

    private Map<UUID, ClientConnection> clientMap = new HashMap<>();
    private Map<PacketChannel, PayloadHandler> packetHandlerMap = new HashMap<>();
    private SocketIoConnector socketIoConnector;

    /**
     * setup the plugin connection
     */
    public NetworkingService() {
        //register socket handlers
        registerHandler(PacketChannel.SOCKET_IN_REGISTER_CLIENT, new ClientConnectHandler());
        registerHandler(PacketChannel.SOCKET_IN_UNREGISTER_CLIENT, new ClientDisconnectHandler());

        try {
            socketIoConnector = new SocketIoConnector();
        } catch (Exception e) {
            System.out.println(OpenAudioMcCore.getLOG_PREFIX() + "The plugin could not start because of a connection problem when requesting the initial private key. Please contact the developers of this plugin.");
            e.printStackTrace();
        }
    }

    /**
     * try to connect to the api, if it is not already connected
     *
     * @throws URISyntaxException server unreachable
     */
    public void connectIfDown() throws URISyntaxException, IOException {
        socketIoConnector.setupConnection();
    }

    /**
     * send a packet to a client connection, if connected
     *
     * @param client the target
     * @param packet the data
     */
    public void send(ClientConnection client, AbstractPacket packet) {
        socketIoConnector.send(client, packet);
    }

    /**
     * a packet got received, this function handles it on to the api for
     * parsing and processing in the plugin
     *
     * @param abstractPacket received
     */
    public void triggerPacket(AbstractPacket abstractPacket) {
        if (packetHandlerMap.get(abstractPacket.getPacketChannel()) == null) {
            System.out.println(OpenAudioMcCore.getLOG_PREFIX() + "Unknown handler for packet type " + abstractPacket.getClass().getName());
            return;
        }
        packetHandlerMap.get(abstractPacket.getPacketChannel()).trigger(abstractPacket);
    }

    /**
     * link a handler to a packet type
     *
     * @param type channel id
     * @param handler handler
     */
    private void registerHandler(PacketChannel type, PayloadHandler handler) {
        packetHandlerMap.put(type, handler);
    }

    /**
     * @param uuid the uuid of a player
     * @return the client that corresponds to the player. can be null
     */
    public ClientConnection getClient(UUID uuid) {
        return clientMap.get(uuid);
    }

    /**
     * @return a collection of all clients
     */
    public Collection<ClientConnection> getClients() {
        return clientMap.values();
    }

    /**
     * @param player the player to unregister
     */
    public void remove(UUID player) {
        if (clientMap.containsKey(player)) {
            ClientConnection client = clientMap.get(player);
            client.kick();
            clientMap.remove(player);
        }
    }

    /**
     * close the socket by force, because you are a strong and independent instance
     */
    public void stop() {
        socketIoConnector.disconnect();
    }
}