<?php

namespace Moxl\Stanza;

use Movim\Session;

class Presence
{
    /*
     * The presence builder
     */
    public static function maker($to = false, $status = false, $show = false, $priority = 0, $type = false)
    {
        $session = Session::start();

        $dom = new \DOMDocument('1.0', 'UTF-8');
        $root = $dom->createElementNS('jabber:client', 'presence');
        $dom->appendChild($root);

        $me = \App\User::me();

        if ($me && $me->session) {
            $root->setAttribute('from', $me->id.'/'.$me->session->resource);
        }

        $root->setAttribute('id', $session->get('id'));

        if ($to != false) {
            $root->setAttribute('to', $to);
        }

        if ($type != false) {
            $root->setAttribute('type', $type);
        }

        if ($status != false) {
            $status = $dom->createElement('status', $status);
            $root->appendChild($status);
        }

        if ($show != false) {
            $show = $dom->createElement('show', $show);
            $root->appendChild($show);
        }

        if ($priority != 0) {
            $priority = $dom->createElement('priority', $priority);
            $root->appendChild($priority);
        }

        $c = $dom->createElementNS('http://jabber.org/protocol/caps', 'c');
        $c->setAttribute('hash', 'sha-1');
        $c->setAttribute('node', 'http://moxl.movim.eu/');
        $c->setAttribute('ext', 'pmuc-v1 share-v1 voice-v1 video-v1 camera-v1');
        $c->setAttribute('ver', \Moxl\Utils::generateCaps());
        $root->appendChild($c);

        return $dom->saveXML($dom->documentElement);
    }

    /*
     * Simple presence without parameters
     */
    public static function simple()
    {
        $xml = self::maker(false, false, false, false, false);
        \Moxl\API::request($xml);
    }

    /*
     * Subscribe to someone presence
     */
    public static function unavailable($to = false, $status = false, $type = false)
    {
        $xml = self::maker($to, $status, false, false, 'unavailable');
        \Moxl\API::request($xml, $type);
    }

    /*
     * Subscribe to someone presence
     */
    public static function subscribe($to, $status)
    {
        $xml = self::maker($to, $status, false, false, 'subscribe');
        \Moxl\API::request($xml);
    }

    /*
     * Unsubscribe to someone presence
     */
    public static function unsubscribe($to, $status)
    {
        $xml = self::maker($to, $status, false, false, 'unsubscribe');
        \Moxl\API::request($xml);
    }

    /*
     * Accept someone presence \Moxl\API::request
     */
    public static function subscribed($to)
    {
        $xml = self::maker($to, false, false, false, 'subscribed');
        \Moxl\API::request($xml);
    }

    /*
     * Refuse someone presence \Moxl\API::request
     */
    public static function unsubscribed($to)
    {
        $xml = self::maker($to, false, false, false, 'unsubscribed');
        \Moxl\API::request($xml);
    }

    /*
     * Enter a chat room
     */
    public static function muc($to, $nickname = false, $mam = false)
    {
        $session = Session::start();

        $dom = new \DOMDocument('1.0', 'UTF-8');
        $presence = $dom->createElementNS('jabber:client', 'presence');
        $dom->appendChild($presence);

        $me = \App\User::me();

        $presence->setAttribute('from', $me->id.'/'.$me->session->resource);
        $presence->setAttribute('id', $session->get('id'));
        $presence->setAttribute('to', $to.'/'.$nickname);

        $x = $dom->createElementNS('http://jabber.org/protocol/muc', 'x');

        if ($mam) {
            $history = $dom->createElement('history');
            $history->setAttribute('maxchars', 0);
            $x->appendChild($history);
        }

        $presence->appendChild($x);

        \Moxl\API::request($dom->saveXML($dom->documentElement));
    }

    /*
     * Go away
     */
    public static function away($status = false)
    {
        $xml = self::maker(false, $status, 'away', -1, false);
        \Moxl\API::request($xml);
    }

    /*
     * Go chatting
     */
    public static function chat($status = false)
    {
        $xml = self::maker(false, $status, 'chat', 1, false);
        \Moxl\API::request($xml);
    }

    /*
     * Do not disturb
     */
    public static function DND($status = false)
    {
        $xml = self::maker(false, $status, 'dnd', 1, false);
        \Moxl\API::request($xml);
    }

    /*
     * eXtended Away
     */
    public static function XA($status = false)
    {
        $xml = self::maker(false, $status, 'xa', -1, false);
        \Moxl\API::request($xml);
    }
}
